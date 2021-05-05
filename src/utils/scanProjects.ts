import * as fs from 'fs';
import * as path from 'path';

export const scanProjects = (workspaceDir: string): string[] => {
  var results: string[] = [];

  var walk = function (workspaceDir: string): void {
    var list = fs.readdirSync(workspaceDir);

    list.forEach(function (file: string) {
      file = path.join(workspaceDir, file);
      var stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
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
