import type { SetupResult } from "./types";

export const runSetup = async (opts: { worktreePath: string; command: string[] }): Promise<SetupResult> => {
  const proc = Bun.spawn(opts.command, {
    cwd: opts.worktreePath,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, WORKTREE_PATH: opts.worktreePath },
  });

  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);

  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
};

export const runSetupScript = async (opts: { worktreePath: string; script: string }) => {
  return runSetup({
    worktreePath: opts.worktreePath,
    command: ["sh", "-c", opts.script],
  });
};
