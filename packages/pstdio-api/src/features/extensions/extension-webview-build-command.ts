import { spawn as nodeSpawn } from "node:child_process";

export type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type BuildCommandRunner = (
  file: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<CommandResult>;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const defaultRunCommand: BuildCommandRunner = (file, args, options) =>
  new Promise((resolveResult) => {
    let child: ReturnType<typeof nodeSpawn>;
    try {
      child = nodeSpawn(file, args, { cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolveResult({ exitCode: 1, stdout: "", stderr: errorMessage(error) });
      return;
    }

    if (!child.stdout || !child.stderr) {
      child.kill("SIGKILL");
      resolveResult({ exitCode: 1, stdout: "", stderr: "Failed to start webview build command." });
      return;
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => resolveResult({ exitCode: 1, stdout: "", stderr: error.message }));
    child.on("close", (code) => {
      resolveResult({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
