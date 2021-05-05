import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import * as path from 'path';
import { TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';
import { parseLineTestErrors, parseTestErrors, parseTests, TestErrors } from './exUnit/tests_parsers';

interface TestResult {
  state: 'failed' | 'passed';
  nodeId: 'string';
  error?: 'string';
}

export class ExUnit {
  private tests: TestSuiteInfo;
  public appDir: string;
  public appName: string;
  private isUmbrella: boolean;
  private currentProcess: childProcess.ChildProcess | undefined;

  constructor(appDir: string, isUmbrella: boolean = false) {
    this.appDir = appDir;
    this.appName = path.parse(this.appDir).name;
    this.isUmbrella = false;
    this.tests = this.appSuite();
  }

  async reloadTests(): Promise<{ tests?: TestSuiteInfo; error?: string }> {
    try {
      this.tests = await this.loadTests();

      return { tests: this.tests };
    } catch (error) {
      return { error, tests: this.tests };
    }
  }

  async reloadTest(path: string): Promise<{ tests?: TestSuiteInfo; error?: string }> {
    const nodeId = path.replace(this.appDir, '').slice(1);
    const node = this.findNode(this.tests, nodeId);

    // if we found a node, we can just replace it
    // if we didn't we have to load all tests again? When would that happen? I don't know, just in case.
    if (node) {
      try {
        const appSuite = await this.loadTests(path);
        const testSuite = this.findNode(appSuite, nodeId) as TestSuiteInfo;

        if (node.type === 'suite') {
          node.children = testSuite.children;
          node.id = testSuite.id;
        }

        return { tests: this.tests };
      } catch (error) {
        return { error, tests: this.tests };
      }
    } else {
      return this.reloadTests();
    }
  }

  cancelProcess() {
    this.currentProcess?.kill();
  }

  async runTests(nodeId: string): Promise<{ testResults?: TestResult[]; error?: string }> {
    try {
      const isLineTest = /\:\d+$/.test(nodeId);
      const stdout = await this.fetchTestResults(nodeId);
      const node = this.findNode(this.tests, nodeId);
      const parseFunction = isLineTest ? parseLineTestErrors : parseTestErrors;
      const testErrors = parseFunction(stdout, nodeId);
      const testResults = this.generateTestResults(node!, testErrors);
      return { testResults };
    } catch (error) {
      return { error };
    }
  }

  private async loadTests(path: string = ''): Promise<TestSuiteInfo> {
    const stdout = await this.fetchTests(path);
    const testsMap = parseTests(this.appDir, stdout);
    return this.buildTestSuite(testsMap);
  }

  private fetchTests(path = ''): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.currentProcess = childProcess.exec(
        `mix test --trace --seed=0 --only="" ${path}`,
        { cwd: this.appDir },
        (err, stdout, stderr) => {
          // Everything is alright
          if (stderr.trim() === 'The --only option was given to "mix test" but no test was executed') {
            return resolve(stdout);
          } else if (stdout.trim().includes('== Compilation error in file')) {
            return reject(stderr + '\n' + stdout);
          }

          return reject(err?.message);
        }
      );
    });
  }

  private async fetchTestResults(nodeId: string) {
    return new Promise<string>((resolve, reject) => {
      const path = nodeId === 'root' ? '' : nodeId;

      this.currentProcess = childProcess.exec(`mix test ${path}`, { cwd: this.appDir }, (err, stdout, stderr) => {
        if (stdout.trim().includes('== Compilation error in file')) {
          return reject(stderr + '\n' + stdout);
        }

        if (stderr.trim()) {
          return reject(stderr);
        }

        return resolve(stdout);
      });
    });
  }

  private buildTestSuite(testsMap: Map<string, Array<TestInfo>>): TestSuiteInfo {
    const formattedTests: TestSuiteInfo = this.appSuite();

    let currentSuite: TestSuiteInfo = formattedTests;
    let currentPath = this.isUmbrella ? `${path.parse(this.appDir).name}/` : '';

    for (const [key, value] of testsMap) {
      if (!key) {
        continue;
      }

      currentSuite = formattedTests;
      currentPath = this.isUmbrella ? `${path.parse(this.appDir).name}/` : '';
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

  private findNode(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
    const internalId = id === 'root' ? this.appDir : id;

    if (searchNode.id === internalId) {
      return searchNode;
    } else if (searchNode.type === 'suite') {
      for (const child of searchNode.children) {
        const found = this.findNode(child, internalId);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  private appSuite(): TestSuiteInfo {
    return { type: 'suite', id: this.appDir, label: `${path.parse(this.appDir).name} ExUnit`, children: [] };
  }
}
