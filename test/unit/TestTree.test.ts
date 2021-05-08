import * as chai from 'chai';
import 'mocha';
import { TestSuiteInfo } from 'vscode-test-adapter-api';
import { MixRunner } from '../../src/MixRunner';
import { TestTree } from '../../src/TestTree';
import { parseMixOutput } from '../../src/utils/tests_parsers';
import { PATHS } from './fixtures/fixtures';

const expect = chai.expect;

describe('TestTree', async () => {
  let tree: TestTree;
  let mix: MixRunner;

  beforeEach(() => {
    mix = new MixRunner();
    tree = new TestTree('workspaceName');
  });

  it('default graph', () => {
    const exportedTree = tree.export() as TestSuiteInfo;

    expect(exportedTree.id).to.equal('ExUnit_suite_root');
    expect(exportedTree.label).to.equal('ExUnit workspaceName');
    expect(exportedTree.children).to.have.lengthOf(0);
  });

  describe('import', () => {
    it('import single test map', async () => {
      const testMaps = parseMixOutput(process.cwd(), PATHS.simpleProject, await mix.run(PATHS.simpleProject));
      tree.import(testMaps);

      const exportedTree = tree.export() as TestSuiteInfo;

      expect(exportedTree.children).to.have.lengthOf(2);
      expect(exportedTree.children.map((x) => x.id)).to.deep.equal(['simple_project_test.exs/', 'nested_dir/']);
    });

    it('import multiple test maps', async () => {
      tree.import(
        parseMixOutput(process.cwd(), PATHS.umbrellaProjectAppOne, await mix.run(PATHS.umbrellaProjectAppOne))
      );
      tree.import(
        parseMixOutput(process.cwd(), PATHS.umbrellaProjectAppTwo, await mix.run(PATHS.umbrellaProjectAppTwo))
      );

      const exportedTree = tree.export() as TestSuiteInfo;

      expect(exportedTree).to.not.be.undefined;
      expect(exportedTree.children).to.have.lengthOf(2);
      expect(exportedTree.children.map((x) => x.id)).to.deep.equal(['app_one_test.exs/', 'app_two_test.exs/']);
    });
  });

  describe('test suites data integrity', () => {
    it('test suites and tests contain correct file, label and id', async () => {
      tree.import(parseMixOutput(process.cwd(), PATHS.simpleProject, await mix.run(PATHS.simpleProject)));

      const exportedTree = tree.export() as TestSuiteInfo;

      // root
      expect(exportedTree.id).to.to.equal('ExUnit_suite_root');
      expect(exportedTree.label).to.to.equal('ExUnit workspaceName');
      expect(exportedTree.file).to.to.equal(undefined);

      // test suite (file)
      const file = exportedTree.children[0];
      expect(file.type).to.equal('suite');
      expect(file.label).to.equal('simple_project_test.exs');
      expect(file.id).to.equal('simple_project_test.exs/');
      expect(file.file).to.contain('/simple_project/test/simple_project_test.exs');

      // nested test suite
      const suite = exportedTree.children[1];
      expect(suite.type).to.equal('suite');
      expect(suite.label).to.equal('nested_dir');
      expect(suite.id).to.equal('nested_dir/');
      expect(suite.file).to.contain('/simple_project/test/nested_dir/nested_test.exs');

      // test suite (file)
      const test = (exportedTree.children[1] as TestSuiteInfo).children[0];
      expect(test.type).to.equal('suite');
      expect(test.label).to.equal('nested_test.exs');
      expect(test.id).to.equal('nested_dir/nested_test.exs/');
      expect(test.file).to.contain('/simple_project/test/nested_dir/nested_test.exs');
    });
  });
});
