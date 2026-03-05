export class GitError extends Error {
  constructor(
    public readonly command: string,
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(`git ${command} failed (exit ${exitCode}): ${stderr}`);
    this.name = "GitError";
  }
}

export const git = async (cwd: string, args: string[]) => {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new GitError(args.join(" "), exitCode, stderr.trim());
  }

  return stdout.trim();
};
