import * as chai from 'chai';
import 'mocha';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
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

      expect(exportedTree.children).to.have.lengthOf(1);
      expect(exportedTree.children.map((x) => x.id)).to.deep.equal(['simple_project/']);
    });

    it('import multiple test maps', async () => {
      const project1 = await mix.run(PATHS.umbrellaProjectAppOne);
      tree.import(parseMixOutput(process.cwd(), PATHS.umbrellaProjectAppOne, project1));

      const project2 = await mix.run(PATHS.umbrellaProjectAppTwo);
      tree.import(parseMixOutput(process.cwd(), PATHS.umbrellaProjectAppTwo, project2));

      const exportedTree = tree.export() as TestSuiteInfo;

      expect(exportedTree).to.not.be.undefined;
      expect(exportedTree.children).to.have.lengthOf(2);
      expect(exportedTree.children.map((x) => x.id)).to.deep.equal(['app_one/', 'app_two/']);
    });
  });

  describe('test suites data integrity', () => {
    it('test suites and tests contain correct file, label and id', async () => {
      tree.import(parseMixOutput(process.cwd(), PATHS.simpleProject, await mix.run(PATHS.simpleProject)));

      const exportedTree = tree.export() as TestSuiteInfo;

      // root
      expect(exportedTree.id).to.equal('ExUnit_suite_root');
      expect(exportedTree.label).to.equal('ExUnit workspaceName');
      expect(exportedTree.file).to.equal(undefined);

      // test suite (directory)
      const directory = exportedTree.children[0] as TestSuiteInfo;
      expect(directory.type).to.equal('suite');
      expect(directory.label).to.equal('simple_project');
      expect(directory.id).to.equal('simple_project/');
      expect(directory.file).to.contain('/test/nested_dir/nested_test.exs');

      // nested test suite (file)
      const suite = directory.children[0] as TestSuiteInfo;
      expect(suite.type).to.equal('suite');
      expect(suite.label).to.equal('simple_project_test.exs');
      expect(suite.id).to.equal('simple_project/simple_project_test.exs/');
      expect(suite.file).to.contain('/simple_project/test/simple_project_test.exs');

      // test suite (file)
      const test = suite.children[1] as TestInfo;
      expect(test.type).to.equal('test');
      expect(test.label).to.equal('greets the world');
      expect(test.id).to.equal('test/unit/fixtures/simple_project/test/simple_project_test.exs:5');
      expect(test.file).to.contain('simple_project/test/simple_project_test.exs');
    });
  });
});
