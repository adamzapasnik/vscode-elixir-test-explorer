import path = require('path');
import * as fs from 'fs';
import { TestSuiteInfo } from 'vscode-test-adapter-api';
import { MixParser } from './MixParser';
import { MixRunner } from './MixRunner';
import { TestTree } from './TestTree';
import { parseMixOutput } from './utils/tests_parsers';

export interface TestResult {
  state: 'failed' | 'passed';
  nodeId: 'string';
  error?: 'string';
}

/*
 This class is responsible for loading and running tests.
 Under the hood it uses the TestTree and the MixRunner to do so.
*/
export class ExUnitRunner {
  private mixRunner: MixRunner;
  private mixParser: MixParser;
  private testTree: TestTree;

  constructor(workspaceName: string) {
    this.mixRunner = new MixRunner();
    this.mixParser = new MixParser();
    this.testTree = new TestTree(workspaceName);
  }

  public cancelProcess() {
    this.mixRunner.kill();
  }

  public async load(testDirs: string[]): Promise<TestSuiteInfo> {
    await Promise.all(
      testDirs.map(async (testDir) => {
        const stdout = await this.mixRunner.run(testDir);
        const testsMap = parseMixOutput(testDir, stdout);
        this.testTree.import(testsMap);
      })
    );

    return this.testTree.export() as TestSuiteInfo;
  }

  public async evaluate(nodeId: string): Promise<{ testResults?: TestResult[]; error?: string }> {
    try {
      const testNode = this.testTree.getNode(nodeId);
      const stdout = await this.mixRunner.evaluate(testNode.mixPath, testNode.file!);
      const testExplorerNode = this.testTree.export({ scope: 'NODE_ID', nodeId: nodeId });

      let testResults;
      const isLineTest = /.*\:\d+$/.test(testExplorerNode.id!);
      if (isLineTest) {
        testResults = this.mixParser.parseTest(stdout, testExplorerNode);
      } else {
        testResults = this.mixParser.parseTests(stdout, testExplorerNode);
      }

      return { testResults: testResults };
    } catch (error) {
      return { error };
    }
  }

  public scan(workspaceDir: string): string[] {
    const hasAdjacentTestDir = (filePath: string): boolean => {
      const testDir = path.join(path.dirname(filePath), 'test');
      return fs.existsSync(testDir);
    };

    const isNotBuildDir = (file: string) => {
      return !(file.endsWith('deps') || file.endsWith('_build') || file.endsWith('elixir_ls'));
    };

    const results: string[] = [];

    const walk = function (currentDir: string): void {
      const list = fs.readdirSync(currentDir);

      list.forEach(function (file: string) {
        file = path.join(currentDir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && isNotBuildDir(file)) {
          walk(file);
        } else {
          if (file.endsWith('mix.exs') && hasAdjacentTestDir(file)) {
            results.push(path.dirname(file));
          }
        }
      });
    };

    walk(workspaceDir);

    return results;
  }
}
