import * as chai from 'chai';
import 'mocha';
import { MixRunner } from '../../src/MixRunner';
import { TestTree } from '../../src/TestTree';
import { parseMixOutput } from '../../src/utils/tests_parsers';
import { PATHS } from './fixtures/fixtures';

const expect = chai.expect;

describe('TestTree', async () => {
  it('import one test source to graph', async () => {
    const tree = new TestTree();

    tree.import(parseMixOutput(PATHS.simpleProject, await new MixRunner().run(PATHS.simpleProject)));

    tree.print();

    const testAdapterTree = tree.export();
    expect(testAdapterTree).to.not.be.undefined;

    console.log(testAdapterTree);
  });

  it('import multiple test sources to graph', async () => {
    const mix = new MixRunner();
    const tree = new TestTree();

    tree.import(parseMixOutput(PATHS.umbrellaProjectAppOne, await mix.run(PATHS.umbrellaProjectAppOne)));
    tree.import(parseMixOutput(PATHS.umbrellaProjectAppTwo, await mix.run(PATHS.umbrellaProjectAppTwo)));

    tree.print();

    const testAdapterTree = tree.export();
    expect(testAdapterTree).to.not.be.undefined;

    console.log(testAdapterTree);

    // TODO: write assertions
  });
});

// Example test source:
//
// {'test/simple_project_test.exs' => [
//   {
//     type: 'test',
//     id: 'test/simple_project_test.exs:3',
//     label: 'doctest',
//     file: '/Users/benjamingroehbiel/workspace/vscode-elixir-test-explorer/test/unit/fixtures/simple_project/test/simple_project_test.exs',
//     line: 2
//   },
//   {
//     type: 'test',
//     id: 'test/simple_project_test.exs:5',
//     label: 'greets the world',
//     file: '/Users/benjamingroehbiel/workspace/vscode-elixir-test-explorer/test/unit/fixtures/simple_project/test/simple_project_test.exs',
//     line: 4
//   },
//   {
//     type: 'test',
//     id: 'test/simple_project_test.exs:9',
//     label: 'greets the underworld',
//     file: '/Users/benjamingroehbiel/workspace/vscode-elixir-test-explorer/test/unit/fixtures/simple_project/test/simple_project_test.exs',
//     line: 8
//   }
// ]}
