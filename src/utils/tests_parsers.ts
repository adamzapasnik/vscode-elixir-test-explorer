import { TestInfo } from 'vscode-test-adapter-api';
import * as path from 'path';

export interface TestErrors {
  [key: string]: string;
}

export interface ParseOutput {
  absolutePath: string;
  relativePath: string;
  hierarchicalPath: string;
  tests: Array<TestInfo>;
}

// Used by load method, does not evaluate whether tests have passed/failed.
export function parseMixOutput(workspaceDir: string, projectDir: string, stdout: string): Map<string, ParseOutput> {
  const testsMap = new Map<string, ParseOutput>();
  const tests = stdout
    .split('Including tags: [:""]')[1] // compilation and other noise before
    .trim()
    .split('\n\n') // tests grouped per files
    .map((string) => string.split('\n').filter((string) => string)) // sometimes there are no tests, like an empty doctest
    .filter((arr) => arr.length > 1) // Some files don't have tests
    .slice(0, -1); // Finished in 0.2 seconds\n2 doctests, 29 tests, 0 failures, 31 excluded\n\nRandomized with seed 0

  for (const testFile of tests) {
    const projectName = path.basename(projectDir);
    const relativePath = testFile.shift()!.split(' ')!.pop()!.slice(1, -1); // test/file.exs
    const absolutePath = path.join(projectDir, relativePath);

    const testInfos: TestInfo[] = testFile.map((test) => {
      //  * doctest Phoenix.Naming.camelize/1 (1) (excluded) [L#5]\r  * doctest Phoenix.Naming.camelize/1 (1) (excluded) [L#5]
      const parts = test.split('\r').slice(1).join('').trim().substring(2).split(' ');
      const testType = parts.shift(); // doctest | test | or macros (?)
      const lineString = parts.pop() || ''; // [L#1]
      const line = parseInt(lineString.match(/\d+/)![0]);
      parts.pop(); // (excluded)

      const id = `${path.relative(workspaceDir, absolutePath)}:${line}`;

      return {
        type: 'test',
        id: `${id}`,
        label: testType === 'doctest' ? 'doctest' : parts.join(' '),
        file: absolutePath,
        line: line - 1,
      };
    });

    // filter out multiple doctests or macro generated tests
    const filteredTestInfos = testInfos.filter(
      (testInfo, index) => testInfos.findIndex((t) => t.id === testInfo.id) === index
    );

    testsMap.set(relativePath, {
      tests: filteredTestInfos,
      absolutePath: absolutePath,
      relativePath: relativePath,
      hierarchicalPath: path.join(projectName, relativePath),
    });
  }

  return testsMap;
}
