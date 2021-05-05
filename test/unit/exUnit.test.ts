import { ExUnit } from '../../src/exUnit';

describe('exUnit', () => {
  it('reload projects', () => {
    const exUnit = new ExUnit('myproject');

    exUnit.reloadTest('x');
  });
});
