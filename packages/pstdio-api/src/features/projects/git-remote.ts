const runGit = async (args: string[]) => {
  const git = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(git.stdout).text(),
    new Response(git.stderr).text(),
    git.exited,
  ]);
  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
};

/** The `origin` remote of the repository at `folder`, if it has one. */
export const readGitRemote = async (folder: string) => {
  const result = await runGit(["-C", folder, "remote", "get-url", "origin"]);
  return result.exitCode === 0 && result.stdout ? result.stdout : undefined;
};

export const cloneGitRemote = async (remote: string, folder: string) => {
  // `--` keeps a synced remote that starts with `-` from being read as an option.
  const result = await runGit(["clone", "--quiet", "--", remote, folder]);
  if (result.exitCode !== 0) throw new Error(`Could not clone ${remote}: ${result.stderr || result.stdout}`);
};
