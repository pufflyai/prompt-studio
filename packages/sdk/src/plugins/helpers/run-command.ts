import { spawn as nodeSpawn } from "node:child_process";

type CommandOutputOptions = {
  quiet?: boolean;
};

export const runCommand = async (cwd: string, command: string[], options: CommandOutputOptions = {}) => {
  const [cmd, ...args] = command;
  const stdio = options.quiet ? "ignore" : "pipe";

  return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
    const proc = nodeSpawn(cmd, args, { cwd, stdio: ["ignore", stdio, stdio] });

    const stdout: string[] = [];
    const stderr: string[] = [];

    proc.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk.toString()));
    proc.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk.toString()));

    proc.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.join("").trim(),
        stderr: stderr.join("").trim(),
      });
    });
  });
};
