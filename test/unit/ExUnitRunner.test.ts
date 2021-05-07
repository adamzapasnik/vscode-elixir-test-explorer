import * as chai from 'chai';
import 'mocha';
import { ExUnitRunner } from '../../src/ExUnitRunner';
import { PATHS } from './fixtures/fixtures';
import * as fixtures from './fixtures/fixtures';

const expect = chai.expect;

describe('ExUnitRunner', async () => {
  let exUnit: ExUnitRunner;
  beforeEach(() => {
    exUnit = new ExUnitRunner('my_project');
  });

  it('load all tests successfully', async () => {
    const result = await exUnit.load([PATHS.simpleProject, PATHS.umbrellaProjectAppOne]);

    expect(result.id).to.equal('exunit_suite_root');
    expect(result.label).to.equal('ExUnit my_project');
    expect(result.type).to.equal('suite');
    expect(result.children).to.have.lengthOf(6);
  });

  it('run', () => {
    //TODO: write tests
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
  });
});
