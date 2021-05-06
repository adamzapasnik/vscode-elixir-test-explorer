import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { MixRunner } from './MixRunner';
import { TestTree } from './TestTree';
import { parseLineTestErrors, parseMixOutput, parseTestErrors, TestErrors } from './utils/tests_parsers';

interface TestResult {
  state: 'failed' | 'passed';
  nodeId: 'string';
  error?: 'string';
}

/*
 This class is responsible for loading and running tests.
 Under the hood it uses the TestTree and the MixRunner to do so.
*/
export class ExUnitRunner {
  private workspaceName: string;
  private mix: MixRunner;
  private testTree: TestTree;

  constructor(workspaceName: string) {
    this.mix = new MixRunner();
    this.testTree = new TestTree();
    this.workspaceName = workspaceName;
  }

  cancelProcess() {
    this.mix.kill();
  }

  async load(testDirs: string[]): Promise<TestSuiteInfo> {
    await Promise.all(
      testDirs.map(async (testDir) => {
        const stdout = await this.mix.run(testDir);
        const testsMap = parseMixOutput(testDir, stdout);
        this.testTree.import(testsMap);
      })
    );

    return this.testTree.export() as TestSuiteInfo;
  }

  async run(testDir: string, nodeId: string): Promise<{ testResults?: TestResult[]; error?: string }> {
    try {
      const isLineTest = /\:\d+$/.test(nodeId);
      const stdout = await this.mix.runSingleTest(testDir, nodeId);
      const node = this.testTree.export({ scope: 'NODE_ID', nodeId: nodeId });
      const parseFunction = isLineTest ? parseLineTestErrors : parseTestErrors;
      const testErrors = parseFunction(stdout, nodeId);
      const testResults = this.generateTestResults(node!, testErrors);
      return { testResults };
    } catch (error) {
      return { error };
    }
  }

  // TODO: replace with graph abstraction
  private generateTestResults(node: TestSuiteInfo | TestInfo, errors: TestErrors) {
    // update tree
    let currentResults: TestResult[] = [];
    if (node.type === 'suite') {
      for (const child of node.children) {
        currentResults = currentResults.concat(this.generateTestResults(child, errors));
      }
    } else {
      currentResults.push(<TestResult>{
        nodeId: node.id,
        state: errors[node.id] ? 'failed' : 'passed',
        error: errors[node.id],
      });
    }
    return currentResults;
  }
}
