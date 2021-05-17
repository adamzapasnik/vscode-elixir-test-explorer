import * as childProcess from 'child_process';

/*
 Responsible for running mix tasks and passing the output as a string.
*/
export class MixRunner {
  private currentProcess: childProcess.ChildProcess | undefined;

  constructor() {
    this.currentProcess = undefined;
  }

  public async run(projectDir: string, path = ''): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const command = `mix test --trace --seed=0 --only="" ${path}`;

      this.currentProcess = childProcess.exec(command, { cwd: projectDir }, (err, stdout, stderr) => {
        if (stderr.trim() === 'The --only option was given to "mix test" but no test was executed') {
          return resolve(stdout);
        } else if (stdout.trim().includes('== Compilation error in file')) {
          return reject(`Failed to load tests in project ${projectDir}:\n ${stderr} \n ${stdout}`);
        } else if (stdout.trim().includes('Finished in')) {
          return resolve(stdout);
        }

        return reject(`Failed to load tests in project ${projectDir}:\n ${err?.message}`);
      });
    });
  }

  // TODO: can these two methods not be merged? I don't understand the difference.
  public async evaluate(mixPath: string, filePath: string = ''): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const command = `mix test ${filePath}`;

      this.currentProcess = childProcess.exec(command, { cwd: mixPath }, (_, stdout, stderr) => {
        if (stdout.includes('Paths given to "mix test" did not match any directory/file')) {
          return reject(`Failed to run tests in project ${mixPath}:\n ${stdout}`);
        }

        if (stdout.trim().includes('== Compilation error in file')) {
          return reject(`Failed to run tests in project ${mixPath}:\n ${stderr} + '\n' + ${stdout}`);
        }

        if (stdout.trim().includes('Finished in')) {
          return resolve(stdout);
        }

        if (stderr.trim()) {
          return reject(`Failed to run tests in project ${mixPath}:\n ${stderr}`);
        }

        return resolve(stdout);
      });
    });
  }

  public kill() {
    this.currentProcess?.kill();
  }
}
