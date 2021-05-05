import * as vscode from 'vscode';
import {
  TestAdapter,
  TestLoadStartedEvent,
  TestLoadFinishedEvent,
  TestRunStartedEvent,
  TestRunFinishedEvent,
  TestSuiteEvent,
  TestSuiteInfo,
  TestInfo,
  TestEvent,
} from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { ExUnit } from './exUnit';

import * as path from 'path';
import * as fs from 'fs';

export class ExUnitAdapter implements TestAdapter {
  private disposables: { dispose(): void }[] = [];

  private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
  private readonly testStatesEmitter = new vscode.EventEmitter<
    TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
  >();
  private readonly autorunEmitter = new vscode.EventEmitter<void>();

  get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
    return this.testsEmitter.event;
  }
  get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> {
    return this.testStatesEmitter.event;
  }
  get autorun(): vscode.Event<void> | undefined {
    return this.autorunEmitter.event;
  }

  private exUnits: ExUnit[] = [];
  private isUmbrellaWorkspace: boolean = false;

  constructor(public readonly workspace: vscode.WorkspaceFolder, private readonly log: Log) {
    this.log.info('Initializing ExUnit adapter');

    this.isUmbrellaWorkspace = fs.existsSync(this.getAppsDir());

    if (this.isUmbrellaWorkspace) {
      fs.readdirSync(this.getAppsDir(), { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .forEach((dirent) => this.exUnits.push(new ExUnit(path.join(this.getAppsDir(), dirent.name), true)));
    } else {
      this.exUnits.push(new ExUnit(this.getProjectDir()));
    }

    this.disposables.push(this.testsEmitter);
    this.disposables.push(this.testStatesEmitter);
    this.disposables.push(this.autorunEmitter);

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((configChange) => {
        this.onConfigChange(configChange);
      }),
      this
    );
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        this.onFileChange(document);
      }),
      this
    );
    this.disposables.push(
      vscode.workspace.onDidRenameFiles((fileRenameEvent) => {
        this.onFileRename(fileRenameEvent);
      }),
      this
    );
    this.disposables.push(
      vscode.workspace.onDidDeleteFiles((fileDeleteEvent) => {
        this.onFileDelete(fileDeleteEvent);
      }),
      this
    );
  }

  async load(): Promise<void> {
    this.log.info('Loading tests');

    // TODO: to ofc nie ma sensu
    // const mixPath = path.join(this.getProjectDir(), 'mix.exs');
    // const testsPath = path.join(this.getProjectDir(), 'test');

    if (!this.isAdapterEnabled()) {
      //  || !fs.existsSync(mixPath) || !fs.existsSync(testsPath)) {
      this.log.info('Skipped loading');
      return;
    }

    this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

    let allTests: (TestSuiteInfo | TestInfo)[] = [];

    for (const exUnit of this.exUnits) {
      const { tests, error } = await exUnit.reloadTests();
      if (tests) {
        if (this.isUmbrellaWorkspace) {
          allTests.push(tests);
        } else {
          allTests = allTests.concat(tests.children);
        }
      }
    }

    // jesli jest blad w jednym z projektow, to nie pozwala wczytac reszty? TROCHE LIPA
    // ale moge uzyc testsuite info z errored :ok:
    // teoretycznie to powinno tez dzialac dla roota, sprawdzmy to?
    // this.testsEmitter.fire(<TestLoadFinishedEvent>{
    //   type: 'finished',
    //   suite: error ? undefined : tests,
    //   errorMessage: error,
    // });
    this.testsEmitter.fire(<TestLoadFinishedEvent>{
      type: 'finished',
      suite: { type: 'suite', id: 'root', label: `${this.workspace.name} ExUnit`, children: allTests },
    });
  }

  async run(tests: string[]): Promise<void> {
    this.log.info(`Running tests ${JSON.stringify(tests)}`);

    this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });

    // TODO: jesli root to musi odpalic dla kazdego :shrug:

    // tu nawet mozliwe, ze nie musimy tego zbytnio zmieniac? wystarczy znalezodpowiednic  projekt exUnit i odpalic imo
    if (this.isUmbrellaWorkspace) {
      // console.warn(this.exUnits);
      // console.warn(tests);
      // TODO: handle root, we should just iterate trough all exUnits
      for (const test of tests) {
        const exUnitInstance = this.exUnits.find((exUnit) => test.startsWith(exUnit.appName))!;
        const { testResults, error } = await exUnitInstance.runTests(test);

        if (error) {
          this.testStatesEmitter.fire(<TestSuiteEvent>{
            type: 'suite',
            suite: test.split(':')[0],
            state: 'errored',
            message: error,
          });
        }

        if (testResults) {
          for (const { nodeId, error, state } of testResults) {
            this.testStatesEmitter.fire(<TestEvent>{
              type: 'test',
              test: nodeId,
              state: state,
              message: error,
            });
          }
        }
      }
    } else {
      for (const test of tests) {
        const { testResults, error } = await this.exUnits[0].runTests(test);

        if (error) {
          this.testStatesEmitter.fire(<TestSuiteEvent>{
            type: 'suite',
            suite: test.split(':')[0],
            state: 'errored',
            message: error,
          });
        }

        if (testResults) {
          for (const { nodeId, error, state } of testResults) {
            this.testStatesEmitter.fire(<TestEvent>{
              type: 'test',
              test: nodeId,
              state: state,
              message: error,
            });
          }
        }
      }
    }

    this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });
  }

  cancel(): void {
    for (const exUnit of this.exUnits) {
      exUnit.cancelProcess();
    }
  }

  dispose(): void {
    // TODO: czy tutaj cos musze zmienic?
    this.cancel();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  private async reload(filePath: string) {
    // TODO: tu ofc trzeba odnalezc odpowiedni exUnit, ale co z errorami? dunno!
    this.log.info(`Reloading tests in ${filePath}`);

    this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

    // const { tests, error } = await this.exUnit.reloadTest(this.getProjectDir(), filePath);
    // TODO: tu zawsze trzeba roota zwracac? o ja pierdole?
    // const event: TestLoadFinishedEvent = {
    //   type: 'finished',
    //   errorMessage: error,
    //   suite: tests,
    // };

    // this.testsEmitter.fire(event);
  }

  private onConfigChange(configChange: vscode.ConfigurationChangeEvent): void {
    if (configChange.affectsConfiguration('elixirTestExplorer', this.workspace.uri)) {
      this.log.info('Configuration changed');
      this.cancel();
      this.load();
    }
  }

  private onFileChange(textDocument: vscode.TextDocument): void {
    if (!textDocument) {
      return;
    }
    if (textDocument.languageId !== 'elixir') {
      return;
    }
    if (textDocument.isUntitled) {
      return;
    }
    if (!this.isAdapterEnabled()) {
      return;
    }
    const filepath = textDocument.uri.fsPath;
    this.log.info(`${filepath} was saved - checking if this effects ${this.getProjectDir()}`);
    // TODO: ofc umbrella included
    const testsDir = path.join(this.getProjectDir(), 'test');
    if (filepath.endsWith('.exs') && filepath.startsWith(testsDir)) {
      this.log.info('A test file has been edited, reloading tests.');
      this.reload(filepath);
    }
  }

  private onFileRename(fileRenameEvent: vscode.FileRenameEvent): void {
    // TODO: ofc umbrella included

    const testsDir = path.join(this.getProjectDir(), 'test');
    const isTestFileChanged = fileRenameEvent.files.some(
      (file) => file.oldUri.fsPath.endsWith('.exs') && file.oldUri.fsPath.startsWith(testsDir)
    );

    // TODO: optimize it to run reload
    if (isTestFileChanged) {
      this.load();
    }
  }

  private onFileDelete(fileDeleteEvent: vscode.FileDeleteEvent): void {
    // TODO: ofc umbrella included

    const testsDir = path.join(this.getProjectDir(), 'test');
    const isTestFileDeleted = fileDeleteEvent.files.some(
      (file) => file.fsPath.endsWith('.exs') && file.fsPath.startsWith(testsDir)
    );

    // TODO: optimize it to run reload
    if (isTestFileDeleted) {
      this.load();
    }
  }

  private isAdapterEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('elixirTestExplorer', this.workspace);
    return config.get('enabled', true);
  }

  private getProjectDir(): string {
    const config = vscode.workspace.getConfiguration('elixirTestExplorer', this.workspace);
    const workspacePath = this.workspace.uri.fsPath;
    const projectDir = config.get('projectDir', '');

    return projectDir ? path.join(workspacePath, projectDir) : workspacePath;
  }

  private getAppsDir(): string {
    return path.join(this.getProjectDir(), 'apps');
  }
}
