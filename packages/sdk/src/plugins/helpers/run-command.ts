import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

type CommandOutputOptions = {
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
};

const resolveCommandPath = (command: string, env: NodeJS.ProcessEnv) => {
  if (command.includes("/") || command.includes("\\")) return command;

  for (const dir of env.PATH?.split(delimiter) ?? []) {
    const candidate = join(dir || ".", command);

    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep searching the effective PATH.
    }
  }

  return command;
};

export const runCommand = async (cwd: string, command: string[], options: CommandOutputOptions = {}) => {
  const [cmd, ...args] = command;
  const stdio = options.quiet ? "ignore" : "pipe";
  const env = { ...process.env, ...options.env };
  const resolvedCmd = resolveCommandPath(cmd, env);

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([resolvedCmd, ...args], {
      cwd,
      env,
      stdin: "ignore",
      stdout: stdio,
      stderr: stdio,
    });
  } catch (error) {
    return { exitCode: 1, stdout: "", stderr: (error as Error).message };
  }

  const readStream = (stream: ReturnType<typeof Bun.spawn>["stdout"]) =>
    stream && typeof stream !== "number" ? new Response(stream).text() : Promise.resolve("");

  const [stdout, stderr] = await Promise.all([readStream(proc.stdout), readStream(proc.stderr)]);

  const exitCode = await proc.exited;

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
};
