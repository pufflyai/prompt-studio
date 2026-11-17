import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join, posix } from "node:path";
import type { WorkspaceFileEntry } from "pstdio-api-contracts";
import { requireGitExecutable } from "pstdio-wt";

const checkIgnored = (root: string, paths: string[], signal?: AbortSignal) => {
  // NUL-delimited input handles directory rules and filenames containing newlines.
  const input = `${paths.join("\0")}\0`;
  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      requireGitExecutable(),
      ["check-ignore", "-z", "--stdin"],
      { cwd: root, signal, maxBuffer: Buffer.byteLength(input) + 1024, windowsHide: true },
      (error, stdout) => {
        if (error && error.code !== 1) reject(error);
        else resolve(stdout);
      },
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
};

export const decorateIgnoredWorkspaceFiles = async (
  root: string,
  entries: WorkspaceFileEntry[],
  signal?: AbortSignal,
) => {
  const repositories = new Map<string, string>();
  const repositoryFor = (directory: string) => {
    const ancestors: string[] = [];
    let repository = "";
    while (directory !== ".") {
      const known = repositories.get(directory);
      if (known !== undefined) {
        repository = known;
        break;
      }
      ancestors.push(directory);
      if (existsSync(join(root, directory, ".git"))) {
        repository = directory;
        break;
      }
      directory = posix.dirname(directory);
    }
    for (const ancestor of ancestors) repositories.set(ancestor, repository);
    return repository;
  };
  const groups = new Map<string, WorkspaceFileEntry[]>();
  for (const entry of entries) {
    const repository = repositoryFor(posix.dirname(entry.path));
    const group = groups.get(repository) ?? [];
    group.push(entry);
    groups.set(repository, group);
  }
  const ignored = new Set<string>();
  // Search results may cross submodule boundaries. Each repository owns its index and ignore rules.
  // Run one batch per repository sequentially, without unbounded Git process fan-out.
  for (const [repository, group] of groups) {
    try {
      const paths = group.map((entry) => (repository ? posix.relative(repository, entry.path) : entry.path));
      const output = await checkIgnored(join(root, repository), paths, signal);
      for (const path of output.split("\0")) if (path) ignored.add(repository ? `${repository}/${path}` : path);
    } catch {
      signal?.throwIfAborted();
      // Plain folders and machines without Git remain browsable without decorations.
    }
  }
  return entries.map((entry) => (ignored.has(entry.path) ? { ...entry, git_ignored: true } : entry));
};
