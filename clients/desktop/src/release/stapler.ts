import { execFile } from "node:child_process";

export const runMacCommand = async (command: string, args: string[]) =>
  new Promise<{
    code: number;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ code: 0, stdout, stderr });
        return;
      }
      if (typeof error.code !== "number") {
        reject(new Error(`Could not run ${command}: ${error.code ?? error.signal}`));
        return;
      }
      resolve({ code: error.code, stdout, stderr });
    });
  });

export const runStapler = async (
  action: "staple" | "validate",
  appPath: string,
  run = runMacCommand,
  wait = async (milliseconds: number) => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  },
) => {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`stapler ${action}: attempt ${attempt}/${attempts}`);
    const result = await run("xcrun", ["stapler", action, "-v", appPath]);
    const output = result.stdout + result.stderr;
    if (result.code === 0) {
      console.log(output.trim());
      return;
    }
    console.error(`stapler ${action} failed with code ${result.code}:\n${output}`);
    const networkFailure = result.code === 68 && output.includes("NSURLErrorDomain");
    if (!networkFailure) throw new Error(`stapler ${action} failed with code ${result.code}:\n${output}`);
    if (attempt === attempts) {
      throw new Error(`Apple ticket service network failure after ${attempts} ${action} attempts:\n${output}`);
    }
    await wait(1000 * 2 ** (attempt - 1));
  }
};
