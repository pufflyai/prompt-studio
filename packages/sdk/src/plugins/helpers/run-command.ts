type CommandOutputOptions = {
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
};

export const runCommand = async (cwd: string, command: string[], options: CommandOutputOptions = {}) => {
  const [cmd, ...args] = command;
  const stdio = options.quiet ? "ignore" : "pipe";

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([cmd, ...args], {
      cwd,
      env: options.env,
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
