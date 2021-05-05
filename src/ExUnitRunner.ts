import * as path from 'path';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { MixRunner } from './MixRunner';
import { parseLineTestErrors, parseTestErrors, parseTests as parseMixOutput, TestErrors } from './utils/tests_parsers';

interface TestResult {
  state: 'failed' | 'passed';
  nodeId: 'string';
  error?: 'string';
}

interface TestSuiteResult {
  tests?: TestSuiteInfo;
  error?: string;
}

export class ExUnitRunner {
  public recentlyRunTests: TestSuiteInfo;
  private workspaceName: string;
  private mix: MixRunner;

  constructor(workspaceName: string) {
    this.mix = new MixRunner();
    this.workspaceName = workspaceName;
    this.recentlyRunTests = this.rootSuite();
  }

  cancelProcess() {
    this.mix.kill();
  }

  async loadAll(testDirs: string[]): Promise<{ suites: (TestSuiteInfo | undefined)[]; hasErrors: boolean }> {
    const results = await Promise.all(
      testDirs.map(async (testDir) => {
        const { tests, error } = await this.reloadTests(testDir);
        return {
          tests: tests,
          error: error,
          projectDir: testDir,
        };
      })
    );

    const hasErrors = results.filter((suite) => suite.error).length === 0 ? false : true;
    const suites = results.map((suite) => suite.tests);

    return {
      suites: suites,
      hasErrors: hasErrors,
    };
  }

  async reloadTests(projectDir: string): Promise<TestSuiteResult> {
    try {
      this.recentlyRunTests = await this.loadTests(projectDir);

      return { tests: this.recentlyRunTests };
    } catch (error) {
      return { error, tests: this.recentlyRunTests };
    }
  }

  async reloadTest(projectDir: string, path: string): Promise<TestSuiteResult> {
    const nodeId = path.replace(projectDir, '').slice(1);
    const node = this.findNode(this.recentlyRunTests, nodeId);

    // if we found a node, we can just replace it
    // if we didn't we have to load all tests again? When would that happen? I don't know, just in case.
    if (node) {
      try {
        const rootSuite = await this.loadTests(path, projectDir);
        const testSuite = this.findNode(rootSuite, nodeId) as TestSuiteInfo;

        if (node.type === 'suite') {
          node.children = testSuite.children;
          node.id = testSuite.id;
        }

        return { tests: this.recentlyRunTests };
      } catch (error) {
        return { error, tests: this.recentlyRunTests };
      }
    } else {
      return this.reloadTests(projectDir);
    }
  }

  async runTests(projectDir: string, nodeId: string): Promise<{ testResults?: TestResult[]; error?: string }> {
    try {
      const isLineTest = /\:\d+$/.test(nodeId);
      const stdout = await this.mix.runSingleTest(projectDir, nodeId);
      const node = this.findNode(this.recentlyRunTests, nodeId);
      const parseFunction = isLineTest ? parseLineTestErrors : parseTestErrors;
      const testErrors = parseFunction(stdout, nodeId);
      const testResults = this.generateTestResults(node!, testErrors);
      return { testResults };
    } catch (error) {
      return { error };
    }
  }

  private async loadTests(projectDir: string, path: string = ''): Promise<TestSuiteInfo> {
    const stdout = await this.mix.run(projectDir, path);
    const testsMap = parseMixOutput(projectDir, stdout);

    console.log(testsMap);

    return this.buildTestSuite(projectDir, testsMap);
  }

  // TODO: rewrite completely
  private buildTestSuite(testDir: string, testsMap: Map<string, Array<TestInfo>>): TestSuiteInfo {
    const formattedTests: TestSuiteInfo = {
      type: 'suite',
      id: testDir,
      label: path.parse(testDir).name,
      children: [],
    };

    let currentSuite: TestSuiteInfo = formattedTests;
    let currentPath = '';

    for (const [key, value] of testsMap) {
      if (!key) {
        continue;
      }

      currentSuite = formattedTests;
      currentPath = '';
      const paths = key.split('/');

      for (const [index, filePath] of paths.entries()) {
        if (filePath === 'test' && index === 0) {
          currentPath += `${filePath}`;

          continue;
        } else if (filePath.endsWith('.exs')) {
          currentPath += `/${filePath}`;
          currentSuite.children.push({
            type: 'suite',
            id: currentPath,
            label: filePath,
            children: value,
          });
        } else {
          currentPath += `/${filePath}`;

          const suiteNode =
            currentSuite.id === currentPath
              ? currentSuite
              : currentSuite.children.find((node) => node.id === currentPath);

          if (suiteNode) {
            currentSuite = suiteNode as TestSuiteInfo;
          } else {
            currentSuite.children.push({
              type: 'suite',
              id: currentPath,
              label: filePath,
              children: [],
            });

            currentSuite = currentSuite.children[currentSuite.children.length - 1] as TestSuiteInfo;
          }
        }
      }
    }

    return formattedTests;
  }

  // TODO: replace with graph abstraction
  private generateTestResults(node: TestSuiteInfo | TestInfo, errors: TestErrors) {
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

  // TODO: remove through graph abstraction
  private findNode(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
    if (searchNode.id === id) {
      return searchNode;
    } else if (searchNode.type === 'suite') {
      for (const child of searchNode.children) {
        const found = this.findNode(child, id);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  // TODO: this goes too
  private rootSuite(): TestSuiteInfo {
    return { type: 'suite', id: 'root', label: `${this.workspaceName} ExUnit`, children: [] };
  }
}
