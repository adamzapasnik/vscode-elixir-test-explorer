import * as fs from 'fs';
import * as path from 'path';

/*
  Scans the workspace for ExUnit projects.

  The criteria is a mix.exs file and a neighboring /test directory.
  It ignores /deps directories to avoid loading tests from dependencies.
*/
export const scanProjects = (workspaceDir: string): string[] => {
  var results: string[] = [];

  var walk = function (currentDir: string): void {
    var list = fs.readdirSync(currentDir);

    list.forEach(function (file: string) {
      file = path.join(currentDir, file);
      var stat = fs.statSync(file);
      if (stat && stat.isDirectory() && isNotDepsDir(file)) {
        walk(file);
      } else {
        if (file.endsWith('mix.exs') && hasAdjacentTestDir(file)) {
          results.push(path.dirname(file));
        }
      }
    });
  };

  walk(workspaceDir);

  return results;
};

const hasAdjacentTestDir = (filePath: string): boolean => {
  const testDir = path.join(path.dirname(filePath), 'test');
  return fs.existsSync(testDir);
};

const isNotDepsDir = (file: string) => {
  return !file.endsWith('deps');
};
