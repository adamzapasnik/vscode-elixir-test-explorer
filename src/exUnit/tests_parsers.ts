import { TestInfo } from 'vscode-test-adapter-api';
import * as path from 'path';

export interface TestErrors {
  [key: string]: string;
}

export function parseTests(appDir: string, stdout: string): Map<string, Array<TestInfo>> {
  const testsMap = new Map();
  const tests = stdout
    .split('Including tags: [:""]')[1] // compilation and other noise before
    .trim()
    .split('\n\n') // tests grouped per files
    .map((string) => string.split('\n').filter((string) => string)) // sometimes there are no tests, like an empty doctest
    .filter((arr) => arr.length > 1) // Some files don't have tests
    .slice(0, -1); // Finished in 0.2 seconds\n2 doctests, 29 tests, 0 failures, 31 excluded\n\nRandomized with seed 0

  for (const testFile of tests) {
    const testFilePath = testFile.shift()!.split(' ')!.pop()!.slice(1, -1);
    const testInfos: TestInfo[] = testFile.map((test) => {
      //  * doctest Phoenix.Naming.camelize/1 (1) (excluded) [L#5]\r  * doctest Phoenix.Naming.camelize/1 (1) (excluded) [L#5]
      const parts = test.split('\r').slice(1).join('').trim().substring(2).split(' ');
      const testType = parts.shift(); // doctest | test | or macros (?)
      const lineString = parts.pop() || ''; // [L#1]
      const line = parseInt(lineString.match(/\d+/)![0]);
      parts.pop(); // (excluded)

      return {
        type: 'test',
        id: `${testFilePath}:${line}`,
        label: testType === 'doctest' ? 'doctest' : parts.join(' '),
        file: path.join(appDir, testFilePath),
        line: line - 1,
      };
    });

    // filter out multiple doctests or macro generated tests
    const uniques = testInfos.filter((testInfo, index) => testInfos.findIndex((t) => t.id === testInfo.id) === index);

    // testFilePath can be printed multiple times
    const parsedTests = testsMap.get(testFilePath) || [];
    testsMap.set(testFilePath, parsedTests.concat(uniques));
  }

  return testsMap;
}

export function parseTestErrors(stdout: string): TestErrors {
  const errors = stdout
    .split(/\n\s*\n/)
    .filter((possibleError) => possibleError.trim().match(/^\d+\)/))
    .map((error) => {
      const testPath = error
        .split('\n')
        .find((line) => line.match(/\.exs:\d+/))!
        .trim();
      return [testPath, error];
    });

  const errorsHash: TestErrors = {};

  for (const [testPath, error] of errors) {
    if (testPath) {
      if (errorsHash[testPath]) {
        errorsHash[testPath] += `\n${error}`;
      } else {
        errorsHash[testPath] = error;
      }
    }
  }

  return errorsHash;
}

export function parseLineTestErrors(testPath: string, stdout: string): TestErrors {
  return stdout.includes(testPath) ? { [testPath]: stdout } : {};
}
