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

    expect(exportedTree.id).to.equal('exunit_suite_root');
    expect(exportedTree.label).to.equal('ExUnit workspaceName');
    expect(exportedTree.children).to.have.lengthOf(0);
  });

  describe('modified graph', () => {
    it('import one test source to form graph', async () => {
      tree.import(parseMixOutput(PATHS.simpleProject, await mix.run(PATHS.simpleProject)));

      const exportedTree = tree.export() as TestSuiteInfo;

      expect(exportedTree.children).to.have.lengthOf(4);
      expect(exportedTree.children.map((x) => x.id)).to.deep.equal([
        'test/simple_project_test.exs:3',
        'test/simple_project_test.exs:5',
        'test/simple_project_test.exs:9',
        'nested_dir/',
      ]);
    });

    it('import multiple test sources to form graph', async () => {
      tree.import(parseMixOutput(PATHS.umbrellaProjectAppOne, await mix.run(PATHS.umbrellaProjectAppOne)));
      tree.import(parseMixOutput(PATHS.umbrellaProjectAppTwo, await mix.run(PATHS.umbrellaProjectAppTwo)));

      const exportedTree = tree.export() as TestSuiteInfo;

      expect(exportedTree).to.not.be.undefined;
      expect(exportedTree.children).to.have.lengthOf(4);
      expect(exportedTree.children.map((x) => x.id)).to.deep.equal([
        'test/app_one_test.exs:3',
        'test/app_one_test.exs:5',
        'test/app_two_test.exs:3',
        'test/app_two_test.exs:5',
      ]);
    });
  });
});
