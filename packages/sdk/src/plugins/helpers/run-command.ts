import { spawn as nodeSpawn } from "node:child_process";

type CommandOutputOptions = {
  quiet?: boolean;
};

export const runCommand = async (cwd: string, command: string[], options: CommandOutputOptions = {}) => {
  const [cmd, ...args] = command;
  const stdio = options.quiet ? "ignore" : "pipe";

  return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let settled = false;
    const finish = (exitCode: number, error?: Error) => {
      if (settled) return;
      settled = true;

      const stderrOutput = error ? error.message : stderr.join("");

      resolve({
        exitCode,
        stdout: stdout.join("").trim(),
        stderr: stderrOutput.trim(),
      });
    };
    const proc = nodeSpawn(cmd, args, { cwd, stdio: ["ignore", stdio, stdio] });

    proc.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk.toString()));
    proc.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk.toString()));
    proc.on("error", (error) => finish(1, error));

    proc.on("close", (code) => finish(code ?? 1));
  });
};
