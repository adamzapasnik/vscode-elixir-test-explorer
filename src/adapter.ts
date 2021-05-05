import * as vscode from 'vscode';
import {
  TestAdapter,
  TestLoadStartedEvent,
  TestLoadFinishedEvent,
  TestRunStartedEvent,
  TestRunFinishedEvent,
  TestSuiteEvent,
  TestEvent,
} from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { ExUnit } from './exUnit';

import * as path from 'path';
import * as fs from 'fs';
import { scanProjects } from './utils/scanProjects';

export class ExUnitAdapter implements TestAdapter {
  private disposables: { dispose(): void }[] = [];
  private isLoadingTests = false;

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

  private exUnit: ExUnit;

  constructor(public readonly workspace: vscode.WorkspaceFolder, private readonly log: Log) {
    this.log.info('Initializing ExUnit adapter');

    this.exUnit = new ExUnit(workspace.name);

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
    if (this.isLoadingTests) {
      return;
    }

    if (!this.isAdapterEnabled()) {
      this.log.info('Skipped loading');
      return;
    }

    this.log.info('Loading tests');

    const projects = scanProjects(this.workspace.uri.fsPath);
    this.log.info('Found projects:', projects);

    this.isLoadingTests = true;
    this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

    try {
      const results = await Promise.all(
        projects.map(async (projectDir) => {
          const { tests, error } = await this.exUnit.reloadTests(projectDir);
          this.log.info('Executed', tests);
          return {
            tests: tests,
            error: error,
            projectDir: projectDir,
          };
        })
      );

      const hasErrors = results.filter((suite) => suite.error).length === 0 ? true : false;
      const suites = results.map((suite) => suite.tests);

      const testLoadFinishedEvent = {
        type: 'finished',
        suite: {
          id: 'root',
          type: 'suite',
          label: 'ExUnit',
          children: suites,
          errored: hasErrors,
        },
        errorMessage: hasErrors ? 'Something failed when running the tests' : undefined,
      };

      this.log.info('TestLoadFinished', testLoadFinishedEvent);
      this.testsEmitter.fire(<TestLoadFinishedEvent>testLoadFinishedEvent);
    } catch (exception) {
      this.testsEmitter.fire({ type: 'finished', errorMessage: `Failed parsing projects: ${exception}` });
    } finally {
      this.isLoadingTests = false;
    }
  }

  async run(tests: string[]): Promise<void> {
    this.log.info(`Running tests ${JSON.stringify(tests)}`);

    this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });

    for (const test of tests) {
      const { testResults, error } = await this.exUnit.runTests(this.getProjectDir(), test);

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

    this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });
  }

  cancel(): void {
    this.exUnit.cancelProcess();
  }

  dispose(): void {
    this.cancel();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  private async reload(filePath: string) {
    this.log.info(`Reloading tests in ${filePath}`);

    this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

    const { tests, error } = await this.exUnit.reloadTest(this.getProjectDir(), filePath);

    const event: TestLoadFinishedEvent = {
      type: 'finished',
      errorMessage: error,
      suite: tests,
    };

    this.testsEmitter.fire(event);
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
    // we should be checking projectDir
    const testsDir = path.join(this.getProjectDir(), 'test');
    if (filepath.endsWith('.exs') && filepath.startsWith(testsDir)) {
      this.log.info('A test file has been edited, reloading tests.');
      this.reload(filepath);
    }
  }

  private onFileRename(fileRenameEvent: vscode.FileRenameEvent): void {
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
}
