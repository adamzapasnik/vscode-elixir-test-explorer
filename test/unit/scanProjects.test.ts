import { scanProjects } from '../../src/utils/scanProjects';

describe('project scanning', () => {
  test('finds all projects with tests in umbrella project', () => {
    const rootPath = `${process.cwd()}/test/unit/fixtures/umbrella_project`;

    const roots = scanProjects(rootPath);

    expect(roots).toHaveLength(2);
    expect(roots[0]).toContain('/fixtures/umbrella_project/apps/app_one');
    expect(roots[1]).toContain('/fixtures/umbrella_project/apps/app_two');
  });

  test('finds all projects with tests in simple project', () => {
    const rootPath = `${process.cwd()}/test/unit/fixtures/simple_project`;

    const roots = scanProjects(rootPath);

    expect(roots).toHaveLength(1);
    expect(roots[0]).toContain('/fixtures/simple_project');
  });
});
