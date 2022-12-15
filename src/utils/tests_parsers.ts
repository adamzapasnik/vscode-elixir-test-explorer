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

function splitToTestFileLinesChunk(stdout: string): string[] {
  const linesPerTestFileRegex = /(^\w.+ \[(?:.+\.exs)\](?:\s+\*.+\[L#\d+\])+)/gm;
  const matches = stdout.match(linesPerTestFileRegex);
  return matches || [];
}

function testFileLinesToFileAndTests(chunk: string): { fileLine: string, testLines: string[] } {
  const lines = chunk.trim().split('\n').filter(s => s);
  return {
    fileLine: lines[0],
    testLines: lines.slice(1)
  };
}

function parseTestFileName(fileLine: string): string {
  const fileNamePartPattern = /\[(.+\.exs)\]/;
  const matches = fileLine.match(fileNamePartPattern);
  return matches![1];
}

function parseTestInfo(absolutePath: string, relativePath: string, testLine: string): TestInfo {
  // * doctest Phoenix.Naming.camelize/1 (1) (excluded) [L#5]
  const testLinePattern = /\*\s+(?<type>\w+)\s+(?<label>.+)\s+\(excluded\)\s+\[L#(?<lineNum>\d+)\]/;
  const matches = testLine.trim().match(testLinePattern);
  const lineNum = parseInt(matches!.groups!.lineNum);
  const id = `${relativePath}:${lineNum}`;
  const testType = matches!.groups!.type;
  const label = matches!.groups!.label;

  return {
    type: 'test',
    id: id,
    label: testType === 'doctest' ? 'doctest' : label,
    file: absolutePath,
    line: lineNum - 1,
  };
}

// Used by load method, does not evaluate whether tests have passed/failed.
export function parseMixOutput(projectDir: string, stdout: string): Map<string, ParseOutput> {
  const testsMap = new Map<string, ParseOutput>();

  const cleanOutput = cleanupOutput(stdout);

  const tests = splitToTestFileLinesChunk(cleanOutput)
    .map(chunk => testFileLinesToFileAndTests(chunk))
    .filter((obj) => obj.testLines.length > 0); // Some files don't have tests

  for (const testFile of tests) {
    const projectName = path.basename(projectDir);
    const relativePath = parseTestFileName(testFile.fileLine); // test/file.exs
    const absolutePath = path.join(projectDir, relativePath);

    const testInfos: TestInfo[] = testFile.testLines.map((testLine) => {
      return parseTestInfo(absolutePath, relativePath, testLine);
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

