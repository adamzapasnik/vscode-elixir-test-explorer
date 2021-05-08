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
  private readonly workspaceName: string;
  private readonly workspacePath: string;
  private mixRunner: MixRunner;
  private mixParser: MixParser;
  private testTree: TestTree;

  constructor(workspaceName: string, workspacePath: string) {
    this.mixRunner = new MixRunner();
    this.mixParser = new MixParser();
    this.testTree = new TestTree(workspaceName);
    this.workspaceName = workspaceName;
    this.workspacePath = workspacePath;
  }

  public cancelProcess() {
    this.mixRunner.kill();
  }

  public async load(testDirs: string[]): Promise<TestSuiteInfo> {
    await Promise.all(
      testDirs.map(async (testDir) => {
        const stdout = await this.mixRunner.run(testDir);
        const testsMap = parseMixOutput(this.workspacePath, testDir, stdout);
        this.testTree.import(testsMap);
      })
    );

    return this.testTree.export() as TestSuiteInfo;
  }

  public async evaluate(testDir: string, nodeId: string): Promise<{ testResults?: TestResult[]; error?: string }> {
    try {
      const node = this.testTree.export({ scope: 'NODE_ID', nodeId: nodeId });
      const isLineTest = /.*\:\d+$/.test(node.id!);
      const stdout = await this.mixRunner.evaluate(testDir, node.file!);

      let testResults;
      if (isLineTest) {
        testResults = this.mixParser.parseTest(stdout, node);
      } else {
        testResults = this.mixParser.parseTests(stdout, node);
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

    const isNotDepsDir = (file: string) => {
      return !file.endsWith('deps');
    };

    var results: string[] = [];

    var walk = function (currentDir: string): void {
      var list = fs.readdirSync(currentDir);

      list.forEach(function (file: string) {
        file = path.join(currentDir, file);
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory() && isNotDepsDir(file)) {
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
