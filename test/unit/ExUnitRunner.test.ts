import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { ExUnitRunner } from '../../src/ExUnitRunner';
import { PATHS } from './fixtures/fixtures';
import * as chai from 'chai';
import 'mocha';

const expect = chai.expect;

describe('ExUnitRunner', async () => {
  it('load all tests', async () => {
    const exUnit = new ExUnitRunner('my_project');

    const result = await exUnit.load([PATHS.simpleProject, PATHS.umbrellaProjectAppOne]);

    expect(result.children).to.have.lengthOf(3);

    expect(result.children[0]?.label).to.eq('simple_project');

    const testSuite = (result.children[0] as TestSuiteInfo).children[0] as TestSuiteInfo;
    expect(testSuite.label).to.eq('simple_project_test.exs');
    expect(testSuite.id).to.eq('test/simple_project_test.exs');
    expect(testSuite.message).to.be.undefined;
    expect(testSuite.description).to.be.undefined;
    expect(testSuite.errored).to.be.undefined;
    expect(testSuite.line).to.be.undefined;
    expect(testSuite.type).to.eq('suite');
    expect(testSuite.children).to.have.lengthOf(3);
    expect(testSuite.children).deep.equal([
      {
        file:
          '/Users/benjamingroehbiel/workspace/vscode-elixir-test-explorer/test/unit/fixtures/simple_project/test/simple_project_test.exs',
        id: 'test/simple_project_test.exs:3',
        label: 'doctest',
        line: 2,
        type: 'test',
      },
      {
        file:
          '/Users/benjamingroehbiel/workspace/vscode-elixir-test-explorer/test/unit/fixtures/simple_project/test/simple_project_test.exs',
        id: 'test/simple_project_test.exs:5',
        label: 'greets the world',
        line: 4,
        type: 'test',
      },
      {
        file:
          '/Users/benjamingroehbiel/workspace/vscode-elixir-test-explorer/test/unit/fixtures/simple_project/test/simple_project_test.exs',
        id: 'test/simple_project_test.exs:9',
        label: 'greets the underworld',
        line: 8,
        type: 'test',
      },
    ]);
    expect((testSuite.children[2] as TestInfo).errored).to.be.undefined;
  });
});
