import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { ExUnitRunner } from '../../src/ExUnitRunner';
import { PATHS } from './fixtures';
import * as chai from 'chai';
import 'mocha';

const expect = chai.expect;

describe('ExUnitRunner', async () => {
  it('reload project with tests directory', async () => {
    const exUnit = new ExUnitRunner('my_project');

    const result = await exUnit.reloadTests(PATHS.simpleProject);

    expect(result?.tests?.id).to.not.be.undefined;
    expect(result?.tests?.label).to.eq('simple_project');
    expect(result?.tests?.type).to.eq('suite');
    expect(result?.tests?.children).to.have.lengthOf(1);

    //@ts-ignore
    expect(result?.tests?.children[0].children).to.have.lengthOf(3);
    //@ts-ignore
    expect(result?.tests?.children[0].children[0].file).to.not.be.undefined;
    //@ts-ignore
    expect(result?.tests?.children[0].children[0].label).to.eq('doctest');
    //@ts-ignore
    expect(result?.tests?.children[0].children[0].type).to.eq('test');
    //@ts-ignore
    expect(result?.tests?.children[0].children[0].line).to.eq(2);
  });

  it('reload project without tests directory', async () => {
    const exUnit = new ExUnitRunner('my_project');

    const result = await exUnit.reloadTests(PATHS.umbrellaProject);

    expect(result?.tests?.id).to.not.be.undefined;
    expect(result?.tests?.label).to.eq('my_project ExUnit');
    expect(result?.tests?.type).to.eq('suite');
    expect(result?.tests?.children).to.have.lengthOf(0);
  });

  it('reload project that does not exist', async () => {
    const exUnit = new ExUnitRunner('my_project');

    const result = await exUnit.reloadTest('/x/y', '');

    expect(result.error).to.eq('spawn /bin/sh ENOENT');
    expect(result.tests).to.deep.equal({
      children: [],
      id: 'root',
      label: 'my_project ExUnit',
      type: 'suite',
    });
  });

  it('load all tests', async () => {
    const exUnit = new ExUnitRunner('my_project');

    const result = await exUnit.loadAll([PATHS.simpleProject, PATHS.umbrellaProjectAppOne]);

    expect(result.hasErrors).to.be.false;
    expect(result.suites).to.have.lengthOf(2);

    expect(result.suites[0]?.label).to.eq('simple_project');
    expect(result.suites[0]?.children).to.have.lengthOf(1);

    const testSuite = result.suites[0]?.children[0] as TestSuiteInfo;
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

    expect(result.suites[1]?.label).to.eq('app_one');
    expect(result.suites[1]?.children).to.have.lengthOf(1);
    const newLocal = result.suites[1]?.children[0] as TestInfo;
    expect(newLocal.label).to.eq('app_one_test.exs');
  });
});
