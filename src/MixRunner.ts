import * as childProcess from 'child_process';

export class MixRunner {
  private currentProcess: childProcess.ChildProcess | undefined;

  constructor() {
    this.currentProcess = undefined;
  }

  public async run(projectDir: string, path = ''): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const command = `mix test --trace --seed=0 --only="" ${path}`;

      this.currentProcess = childProcess.exec(command, { cwd: projectDir }, (err, stdout, stderr) => {
        // Everything is alright
        if (stderr.trim() === 'The --only option was given to "mix test" but no test was executed') {
          return resolve(stdout);
        } else if (stdout.trim().includes('== Compilation error in file')) {
          return reject(stderr + '\n' + stdout);
        } else if (stdout.trim().includes('Finished in')) {
          return resolve(stdout);
        }

        return reject(err?.message);
      });
    });
  }

  // TODO: not clear what the difference here is between the two methods.
  public async runSingleTest(projectDir: string, nodeId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const path = nodeId === 'root' ? '' : nodeId;

      this.currentProcess = childProcess.exec(`mix test ${path}`, { cwd: projectDir }, (err, stdout, stderr) => {
        if (stdout.trim().includes('Finished in')) {
          return resolve(stdout);
        }

        if (stdout.trim().includes('== Compilation error in file')) {
          return reject(stderr + '\n' + stdout);
        }

        if (stderr.trim()) {
          return reject(stderr);
        }

        return resolve(stdout);
      });
    });
  }

  public kill() {
    this.currentProcess?.kill();
  }
}
