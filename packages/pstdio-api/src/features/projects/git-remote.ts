const CLONE_TIMEOUT_MS = 15 * 60_000;

// A synced remote is chosen on another device, so cloning it must not prompt, hang or run another transport.
const cloneConfig = ["-c", "protocol.allow=never", "-c", "protocol.https.allow=always"];
const cloneProtocols = ["ssh", "file"].flatMap((protocol) => ["-c", `protocol.${protocol}.allow=always`]);
const cloneEnvironment = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_SSH_COMMAND: "ssh -o BatchMode=yes",
};

const runGit = async (
  args: string[],
  options: { env?: Record<string, string | undefined>; signal?: AbortSignal } = {},
) => {
  try {
    const git = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe", ...options });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(git.stdout).text(),
      new Response(git.stderr).text(),
      git.exited,
    ]);
    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    // Git may not be installed on this device.
    return { exitCode: -1, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
  }
};

// Every member and device sees the recorded remote, so it keeps the address and drops any credentials.
const withoutCredentials = (remote: string) => {
  try {
    const url = new URL(remote);
    if (url.protocol !== "http:" && url.protocol !== "https:") return remote;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return remote;
  }
};

/** The `origin` remote of the repository at `folder`, as configured there and without credentials. */
export const readGitRemote = async (folder: string) => {
  // `remote get-url` applies `insteadOf` rewrites, which can add a token from this machine's settings.
  const result = await runGit(["-C", folder, "config", "--get", "remote.origin.url"]);
  return result.exitCode === 0 && result.stdout ? withoutCredentials(result.stdout) : undefined;
};

// `git@host:owner/repo.git`, `ssh://git@host/owner/repo` and `https://host/owner/repo` name one repository.
const repositoryAddress = (remote: string) => {
  const scp = /^[^/@]+@([^:/]+):(.+)$/.exec(remote);
  let address = remote;
  if (scp) address = `${scp[1]!.toLowerCase()}/${scp[2]}`;
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(remote) && URL.canParse(remote)) {
    const url = new URL(remote);
    address = url.protocol === "file:" ? url.pathname : `${url.hostname.toLowerCase()}${url.pathname}`;
  }
  return address.replace(/\/+$/, "").replace(/\.git$/, "");
};

export const sameRepository = (left: string, right: string) => repositoryAddress(left) === repositoryAddress(right);

export const cloneGitRemote = async (remote: string, folder: string) => {
  // `--` keeps a synced remote that starts with `-` from being read as an option.
  const result = await runGit([...cloneConfig, ...cloneProtocols, "clone", "--quiet", "--", remote, folder], {
    env: cloneEnvironment,
    signal: AbortSignal.timeout(CLONE_TIMEOUT_MS),
  });
  if (result.exitCode !== 0) throw new Error(`Could not clone ${remote}: ${result.stderr || result.stdout}`);
};
