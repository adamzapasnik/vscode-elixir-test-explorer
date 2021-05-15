import * as chai from 'chai';
import 'mocha';
import { ExUnitRunner } from '../../src/ExUnitRunner';
import { PATHS } from './fixtures/fixtures';
import * as fixtures from './fixtures/fixtures';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

const expect = chai.expect;

describe('ExUnitRunner', async () => {
  let exUnit: ExUnitRunner;

  beforeEach(() => {
    exUnit = new ExUnitRunner('my_project', process.cwd());
  });

  describe('load', () => {
    it('load', async () => {
      const result = await exUnit.load([PATHS.simpleProject, PATHS.umbrellaProjectAppOne]);

      // main test suite
      expect(result.id).to.equal('ExUnit_suite_root');
      expect(result.label).to.equal('ExUnit my_project');
      expect(result.type).to.equal('suite');
      expect(result.children).to.have.lengthOf(2);
      expect(result.children.map((x) => x.id)).to.deep.equal(['simple_project/', 'app_one/']);

      // test suite (sub directory)
      expect(result.children[1].id).to.equal('app_one/'); // TODO: this may not be unique enough
      expect(result.children[1].label).to.equal('app_one');
      expect(result.children[1].file).to.be.undefined;

      // test suite (sub directory)
      expect((result.children[0] as TestSuiteInfo).children).to.have.lengthOf(2);
      expect((result.children[0] as TestSuiteInfo).children.map((x) => x.id)).to.contain(
        'simple_project/simple_project_test.exs/',
        'simple_project/nested_dir/'
      );

      // test file
      const testFile = (result.children[0] as TestSuiteInfo).children[0] as TestSuiteInfo;
      expect(testFile.type).is.equal('suite');
      expect(testFile.file).to.contain('/simple_project/test/simple_project_test.exs');

      // test
      const test = ((result.children[0] as TestSuiteInfo).children[0] as TestSuiteInfo).children[0] as TestInfo;
      expect(test.type).is.equal('test');
      expect(test.file).to.contain('/simple_project/test/simple_project_test.exs');
    });
  });

  describe('evaluate', () => {
    it('evaluate test directory of simple project', async () => {
      await exUnit.load([PATHS.simpleProject]);
      const results = await exUnit.evaluate('simple_project/');

      expect(results.error).to.be.undefined;
      expect(results.testResults).to.have.lengthOf(4);

      expect(results.testResults!.map((result) => result.state)).to.deep.equal([
        'passed',
        'passed',
        'failed',
        'passed',
      ]);
    });

    it('evaluate test directory of umbrella', async () => {
      await exUnit.load([PATHS.umbrellaProjectAppOne]);
      const results = await exUnit.evaluate('app_one/');

      expect(results.error).to.be.undefined;
      expect(results.testResults).to.have.lengthOf(2);

      expect(results.testResults!.map((result) => result.state)).to.deep.equal(['passed', 'passed']);
    });

    it('evaluate test file', async () => {
      await exUnit.load([PATHS.simpleProject]);
      const results = await exUnit.evaluate('simple_project/simple_project_test.exs/');

      expect(results.error).to.be.undefined;
      expect(results.testResults).to.have.lengthOf(3);

      const test = results.testResults![0];
      expect(test.nodeId).to.equal('test/simple_project_test.exs:3');
      expect(test.state).to.equal('passed');
    });

    it('evaluate test', async () => {
      await exUnit.load([PATHS.simpleProject]);
      const results = await exUnit.evaluate('test/simple_project_test.exs:5');

      expect(results.error).to.be.undefined;
      expect(results.testResults).to.have.lengthOf(1);

      const test = results.testResults![0];
      expect(test.nodeId).to.equal('test/simple_project_test.exs:5');
      expect(test.state).to.equal('passed');
    });
  });

  describe('scan', () => {
    it('finds all projects with tests in umbrella project', () => {
      const root = exUnit.scan(fixtures.PATHS.umbrellaProject);

      expect(root).to.have.lengthOf(2);
      expect(root[0]).to.contain('/fixtures/umbrella_project/apps/app_one');
      expect(root[1]).to.contain('/fixtures/umbrella_project/apps/app_two');
    });

    it('finds all projects with tests in simple project', () => {
      const root = exUnit.scan(fixtures.PATHS.simpleProject);

      expect(root).to.have.lengthOf(1);
      expect(root[0]).to.contain('/fixtures/simple_project');
    });

    it('ignores deps directory', () => {
      const projectWithDepsTests = exUnit.scan(fixtures.PATHS.umbrellaProject);

      expect(projectWithDepsTests).to.have.lengthOf(2);
    });

    it('ignores _build directory', () => {
      const projectWithDepsTests = exUnit.scan(fixtures.PATHS.umbrellaProject);

      expect(projectWithDepsTests).to.have.lengthOf(2);
    });
  });
});
