import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { TestResult } from './ExUnitRunner';
import { TestErrors } from './utils/tests_parsers';

export class MixParser {
  public parseTest(output: string, node: TestInfo | TestSuiteInfo): TestResult[] {
    const testErrors = this.parseLineTestErrors(node.id, output);
    const testResults = this.generateTestResults(node!, testErrors);
    return testResults;
  }

  public parseTests(output: string, node: TestInfo | TestSuiteInfo): TestResult[] {
    const testErrors = this.parseTestErrors(output);
    const testResults = this.generateTestResults(node!, testErrors);
    return testResults;
  }

  private generateTestResults(node: TestInfo | TestSuiteInfo, errors: TestErrors): TestResult[] {
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

  private parseTestErrors(stdout: string): TestErrors {
    const errors = stdout
      .split(/\n\s*\n/)
      .filter((possibleError) => possibleError.trim().match(/^\d+\)/))
      .map((error) => {
        const path = error
          .split('\n')
          .find((line) => line.match(/\.exs:\d+/))!
          .trim();
        return [path, error];
      });

    const errorsHash: TestErrors = {};

    for (const [path, error] of errors) {
      if (path) {
        if (errorsHash[path]) {
          errorsHash[path] += `\n${error}`;
        } else {
          errorsHash[path] = error;
        }
      }
    }

    return errorsHash;
  }

  private parseLineTestErrors(path: string, stdout: string): TestErrors {
    return stdout.includes(path) ? { [path]: stdout } : {};
  }
}
