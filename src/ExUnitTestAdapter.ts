import * as path from 'path';
import * as vscode from 'vscode';
import {
  TestAdapter,
  TestEvent,
  TestLoadFinishedEvent,
  TestLoadStartedEvent,
  TestRunFinishedEvent,
  TestRunStartedEvent,
  TestSuiteEvent,
} from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { ExUnitRunner } from './ExUnitRunner';

/*
  ExUnitTestAdapter is the adapter for Test Explorer. 

  It uses the vs code event bus to communicate to Test Explorer.
  It delegates to the ExUnitRunner for when file changes occur.
*/
export class ExUnitTestAdapter implements TestAdapter {
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

  constructor(
    private testRunner: ExUnitRunner,
    public readonly workspace: vscode.WorkspaceFolder,
    private readonly log: Log
  ) {
    this.log.info('Initializing ExUnit adapter');

    this.testRunner = testRunner;

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
    this.isLoadingTests = true;
    this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

    try {
      const testDirs = this.testRunner.scan(this.workspace.uri.fsPath);
      this.log.info('Found projects:', testDirs);

      const suite = await this.testRunner.load(testDirs);

      const testLoadFinishedEvent = {
        type: 'finished',
        suite: suite,
        errorMessage: undefined,
      };

      this.log.info('TestLoadFinished', testLoadFinishedEvent);
      this.testsEmitter.fire(<TestLoadFinishedEvent>testLoadFinishedEvent);
    } catch (exception) {
      this.testsEmitter.fire({ type: 'finished', errorMessage: `Error: ${exception}` });
    } finally {
      this.isLoadingTests = false;
    }
  }

  // TODO: this is not how Test Adapter API recommends, run is implemented:
  // https://github.com/hbenl/vscode-test-adapter-api#running-the-tests
  async run(tests: string[]): Promise<void> {
    this.log.info(`Running tests ${JSON.stringify(tests)}`);

    this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });

    for (const test of tests) {
      const { testResults, error } = await this.testRunner.evaluate(this.workspace.uri.fsPath, test);

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
    this.testRunner.cancelProcess();
  }

  dispose(): void {
    this.cancel();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
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
    this.log.info(`${filepath} was saved - checking if this effects ${this.workspace.uri.fsPath}`);
    // we should be checking projectDir
    const testsDir = path.join(this.workspace.uri.fsPath, 'test');
    if (filepath.endsWith('.exs') && filepath.startsWith(testsDir)) {
      this.log.info('A test file has been edited, reloading tests.');
      this.load(); // TODO: optimise, only reload one file
    }
  }

  private onFileRename(fileRenameEvent: vscode.FileRenameEvent): void {
    const testsDir = path.join(this.workspace.uri.fsPath, 'test');
    const isTestFileChanged = fileRenameEvent.files.some(
      (file) => file.oldUri.fsPath.endsWith('.exs') && file.oldUri.fsPath.startsWith(testsDir)
    );

    if (isTestFileChanged) {
      this.load(); // TODO: optimise, only reload one file
    }
  }

  private onFileDelete(fileDeleteEvent: vscode.FileDeleteEvent): void {
    const testsDir = path.join(this.workspace.uri.fsPath, 'test');
    const isTestFileDeleted = fileDeleteEvent.files.some(
      (file) => file.fsPath.endsWith('.exs') && file.fsPath.startsWith(testsDir)
    );

    if (isTestFileDeleted) {
      this.load(); // TODO: optimise, only reload one file
    }
  }

  private isAdapterEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('elixirTestExplorer', this.workspace);
    return config.get('enabled', true);
  }
}
