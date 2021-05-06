import { scanProjects } from '../../../src/utils/scanProjects';
import * as fixtures from '../fixtures/fixtures';
import * as chai from 'chai';

const expect = chai.expect;

describe('project scanning', () => {
  it('finds all projects with tests in umbrella project', () => {
    const root = scanProjects(fixtures.PATHS.umbrellaProject);

    expect(root).to.have.lengthOf(2);
    expect(root[0]).to.contain('/fixtures/umbrella_project/apps/app_one');
    expect(root[1]).to.contain('/fixtures/umbrella_project/apps/app_two');
  });

  it('finds all projects with tests in simple project', () => {
    const root = scanProjects(fixtures.PATHS.simpleProject);

    expect(root).to.have.lengthOf(1);
    expect(root[0]).to.contain('/fixtures/simple_project');
  });

  it('ignores deps directory', () => {
    const projectWithDepsTests = scanProjects(fixtures.PATHS.umbrellaProject);

    expect(projectWithDepsTests).to.have.lengthOf(2);
  });
});
