import { readStream } from "./context";

type CommandSpawn = (
  command: string[],
  options: {
    cwd: string;
    stdout: "pipe" | "ignore";
    stderr: "pipe" | "ignore";
  },
) => {
  exited: Promise<number>;
  stdout?: ReadableStream | null;
  stderr?: ReadableStream | null;
};

type RunCommandSpawn = CommandSpawn | typeof Bun.spawn;

type CommandOutputOptions = {
  quiet?: boolean;
};

export const runCommand = async (
  spawn: RunCommandSpawn,
  cwd: string,
  command: string[],
  options: CommandOutputOptions = {},
) => {
  const proc = (spawn as CommandSpawn)(command, {
    cwd,
    stdout: options.quiet ? "ignore" : "pipe",
    stderr: options.quiet ? "ignore" : "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([proc.exited, readStream(proc.stdout), readStream(proc.stderr)]);
  return { exitCode, stdout, stderr };
};
