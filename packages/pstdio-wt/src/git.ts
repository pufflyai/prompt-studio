import { execFile, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, win32 } from "node:path";

export class GitUnavailableError extends Error {
  constructor() {
    super("Git is unavailable on this machine. Git features require a working Git installation.");
    this.name = "GitUnavailableError";
  }
}

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

type GitExecutableDeps = {
  developerDirectory?: () => string | null;
  exists?: (path: string) => boolean;
  platform?: NodeJS.Platform | "win32";
  which?: (command: string) => string | null;
};

export const resolveGitExecutable = (deps: GitExecutableDeps = {}) => {
  const which = deps.which ?? ((command: string) => Bun.which(command));
  const resolved = which("git");
  if (!resolved) return null;
  const platform = deps.platform ?? process.platform;
  const exists = deps.exists ?? existsSync;
  if (platform === "darwin" && resolved === "/usr/bin/git") {
    // Apple's stub opens the developer-tools installer. Resolve the selected tools without invoking it.
    const developerDirectory = (
      deps.developerDirectory ??
      (() => {
        const selected = spawnSync("/usr/bin/xcode-select", ["--print-path"], { encoding: "utf8" });
        return selected.status === 0 ? selected.stdout.trim() : null;
      })
    )();
    if (!developerDirectory) return null;
    const executable = join(developerDirectory, "usr/bin/git");
    return exists(executable) ? executable : null;
  }
  if (platform !== "win32") return resolved;
  if (win32.basename(win32.dirname(resolved)).toLowerCase() !== "cmd") return resolved;

  const root = win32.dirname(win32.dirname(resolved));
  const nativeGit = [win32.join(root, "mingw64", "bin", "git.exe"), win32.join(root, "mingw32", "bin", "git.exe")].find(
    exists,
  );

  return nativeGit ?? resolved;
};

export const createGitExecutableResolver = (deps: GitExecutableDeps = {}) => {
  let executable: string | undefined;
  const exists = deps.exists ?? existsSync;
  return () => {
    if (!executable || !exists(executable)) executable = resolveGitExecutable(deps) ?? undefined;
    return executable;
  };
};

const resolveSystemGit = createGitExecutableResolver();

export const requireGitExecutable = () => {
  const executable = resolveSystemGit();
  if (!executable) throw new GitUnavailableError();
  return executable;
};

export const gitBytes = (cwd: string, args: string[]) =>
  new Promise<Buffer>((resolve, reject) => {
    // Keep both pipes owned through completion. See ADR 0024.
    execFile(
      requireGitExecutable(),
      args,
      { cwd, encoding: "buffer", maxBuffer: Number.POSITIVE_INFINITY, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            typeof error.code === "number" ? new GitError(args.join(" "), error.code, stderr.toString().trim()) : error,
          );
          return;
        }
        resolve(stdout);
      },
    );
  });

export const git = async (cwd: string, args: string[]) => (await gitBytes(cwd, args)).toString().trim();

export const isGitAvailable = async () => {
  try {
    return (await git(process.cwd(), ["--version"])).startsWith("git version ");
  } catch {
    return false;
  }
};
