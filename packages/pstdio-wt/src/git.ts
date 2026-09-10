import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 } from "node:path";

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
  exists?: (path: string) => boolean;
  platform?: NodeJS.Platform | "win32";
  which?: (command: string) => string | null;
};

export const resolveGitExecutable = (deps: GitExecutableDeps = {}) => {
  const which = deps.which ?? ((command: string) => Bun.which(command));
  const resolved = which("git") ?? "git";
  if ((deps.platform ?? process.platform) !== "win32") return resolved;
  if (win32.basename(win32.dirname(resolved)).toLowerCase() !== "cmd") return resolved;

  const root = win32.dirname(win32.dirname(resolved));
  const exists = deps.exists ?? existsSync;
  const nativeGit = [win32.join(root, "mingw64", "bin", "git.exe"), win32.join(root, "mingw32", "bin", "git.exe")].find(
    exists,
  );

  return nativeGit ?? resolved;
};

export const gitBytes = (cwd: string, args: string[]) =>
  new Promise<Buffer>((resolve, reject) => {
    // Keep both pipes owned through completion. See ADR 0024.
    execFile(
      resolveGitExecutable(),
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
