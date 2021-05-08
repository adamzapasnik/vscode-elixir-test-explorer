import * as vscode from 'vscode';
import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { Log, TestAdapterRegistrar } from 'vscode-test-adapter-util';
import { ExUnitTestAdapter } from './ExUnitTestAdapter';
import { ExUnitRunner } from './ExUnitRunner';

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];

  // create a simple logger that can be configured with the configuration variables
  // `exampleExplorer.logpanel` and `exampleExplorer.logfile`
  const log = new Log('ExUnit', workspaceFolder, 'ExUnit Explorer Log');
  context.subscriptions.push(log);

  // get the Test Explorer extension
  const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);
  if (log.enabled) {
    log.info(`Test Explorer ${testExplorerExtension ? '' : 'not '}found`);
  }

  if (testExplorerExtension) {
    const testHub = testExplorerExtension.exports;

    // this will register an ExUnitAdapter for each WorkspaceFolder
    const exUnitRunner = new ExUnitRunner(workspaceFolder.name, workspaceFolder.uri.fsPath);
    context.subscriptions.push(
      new TestAdapterRegistrar(
        testHub,
        (workspaceFolder) => new ExUnitTestAdapter(exUnitRunner, workspaceFolder, log),
        log
      )
    );
  }
}
