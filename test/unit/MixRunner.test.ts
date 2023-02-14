import * as chai from 'chai';
import 'mocha';
import { MixRunner } from '../../src/MixRunner';
import { PATHS } from './fixtures/fixtures';

const expect = chai.expect;

describe('MixRunner', async () => {
  describe('run', () => {
    it('run command without path executes only tests in dir', async () => {
      const runner = new MixRunner('');

      const output = await runner.run(PATHS.simpleProject);

      expect(output).to.not.be.empty;
      expect(output).to.contain('Finished in ');

      expect(output).to.contain('test/nested_dir/nested_test.exs');
      expect(output).to.contain('(excluded)'); // one of the tests is failing
    });
  });
});
