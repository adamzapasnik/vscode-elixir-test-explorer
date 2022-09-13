import { TestInfo } from 'vscode-test-adapter-api';
import * as path from 'path';

export interface TestErrors {
  [key: string]: string;
}

export interface ParseOutput {
  absolutePath: string;
  relativePath: string;
  hierarchicalPath: string;
  mixPath: string;
  tests: Array<TestInfo>;
}

// Used by load method, does not evaluate whether tests have passed/failed.
export function parseMixOutput(projectDir: string, stdout: string): Map<string, ParseOutput> {
  const testsMap = new Map<string, ParseOutput>();

  const cleanOutput = cleanupOutput(stdout);

  const tests = cleanOutput
    .trim()
    .replace(/All tests have been excluded./g, "") // Remove the line "All tests have been excluded." introduced by elixir 1.14.0
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

      const id = `${relativePath}:${line}`;

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
      mixPath: absolutePath.substring(0, absolutePath.length - relativePath.length),
    });
  }

  return testsMap;
}
function cleanupOutput(stdout: string) {
  const patternBeforeMeaningfulOutput = /Including tags: \[.*?]/; //we look for a pattern, in order to accomodate for variations (eg :"" and :*)
  const indexBeforeMeaningfulOutput = Math.max(stdout.search(patternBeforeMeaningfulOutput), 0);
  const meaningfulString = stdout.substring(indexBeforeMeaningfulOutput);
  return meaningfulString;
}

