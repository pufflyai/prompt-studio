import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionProcessApi } from "@pstdio/sdk/extensions";

type SourceArchive = {
  archive: ReturnType<typeof Bun.file>;
  files: number;
  revision: string;
  sha256: string;
};

export async function withSourceArchive<T>(
  process: ExtensionProcessApi,
  root: string,
  ref: string | undefined,
  use: (source: SourceArchive) => Promise<T>,
) {
  const revision = await process
    .runOrThrow({
      command: ["git", "-C", root, "rev-parse", "--verify", "--end-of-options", `${ref ?? "HEAD"}^{commit}`],
      timeoutMs: 10_000,
    })
    .then(
      (result) => result.stdout.trim(),
      (error) => {
        if (ref) throw error;
        return "working-tree";
      },
    );
  const directory = await mkdtemp(join(tmpdir(), "remote-testing-"));
  try {
    const tar = join(directory, "source.tar");
    const history = revision !== "working-tree" ? await prepareHistory(process, root, revision, directory) : undefined;
    const files = ref
      ? await archiveCommit(process, history!, revision, tar)
      : await archiveTree(process, root, directory, tar);
    if (history)
      await process.runOrThrow({
        command: ["tar", "-rf", tar, "-C", history, ".git"],
        env: { PATH: globalThis.process.env.PATH ?? "/usr/bin:/bin", COPYFILE_DISABLE: "1" },
        timeoutMs: 300_000,
      });
    await process.runOrThrow({ command: ["gzip", tar], timeoutMs: 300_000 });
    const path = `${tar}.gz`;
    const archive = Bun.file(path);
    const hash = new Bun.CryptoHasher("sha256");
    for await (const chunk of archive.stream()) hash.update(chunk);
    return await use({ archive, files, revision, sha256: hash.digest("hex") });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function archiveCommit(process: ExtensionProcessApi, root: string, revision: string, archive: string) {
  const listed = await process.runOrThrow({
    command: ["git", "-C", root, "ls-tree", "-rz", "--name-only", revision],
    timeoutMs: 60_000,
  });
  // Release export attributes must not alter an exact-commit test snapshot.
  const attributes = join(root, ".git", "info", "attributes");
  await mkdir(join(root, ".git", "info"), { recursive: true });
  await writeFile(attributes, "* -export-ignore -export-subst\n");
  await process.runOrThrow({
    command: ["git", "-C", root, "archive", "--format=tar", "--output", archive, revision],
    timeoutMs: 300_000,
  });
  await rm(attributes);
  return listed.stdout.split("\0").filter(Boolean).length;
}

// Git's file list includes local edits and new files while excluding ignored build output.
async function archiveTree(process: ExtensionProcessApi, root: string, directory: string, archive: string) {
  const listed = await process.runOrThrow({
    command: ["git", "-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    timeoutMs: 60_000,
  });
  const files: string[] = [];
  for (const file of new Set(listed.stdout.split("\0").filter(Boolean))) {
    // Git still lists deleted files and submodule directories.
    const stat = await lstat(join(root, file)).catch(() => null);
    if (stat && !stat.isDirectory()) files.push(file);
  }
  if (!files.length) throw new Error(`No files to test in ${root}.`);
  const list = join(directory, "files");
  await writeFile(list, `${files.join("\0")}\0`);
  await process.runOrThrow({
    command: ["tar", "-cf", archive, "-C", root, "--null", "-T", list],
    // macOS tar otherwise adds a "._" file per file with extended attributes.
    env: { PATH: globalThis.process.env.PATH ?? "/usr/bin:/bin", COPYFILE_DISABLE: "1" },
    timeoutMs: 300_000,
  });
  return files.length;
}

// Fetch into a new repository instead of copying .git: local config, hooks,
// credentials, reflogs and linked-worktree paths must stay on the host.
async function prepareHistory(process: ExtensionProcessApi, root: string, revision: string, directory: string) {
  const shallow = await process.runOrThrow({
    command: ["git", "-C", root, "rev-parse", "--is-shallow-repository"],
    timeoutMs: 10_000,
  });
  if (shallow.stdout.trim() === "true")
    throw new Error("Cloud tests require full Git history. Unshallow the source repository before uploading.");
  const history = join(directory, "history");
  const git = (...args: string[]) =>
    process.runOrThrow({ command: ["git", "-C", history, ...args], timeoutMs: 300_000 });
  await process.runOrThrow({ command: ["git", "init", "--template=", "-q", history], timeoutMs: 10_000 });
  await git("symbolic-ref", "HEAD", "refs/cloud-upload/head");
  await git(
    "fetch",
    "--no-write-fetch-head",
    "--no-tags",
    root,
    revision,
    "+refs/heads/*:refs/heads/*",
    "+refs/remotes/*:refs/remotes/*",
    "+refs/tags/*:refs/tags/*",
  );
  await git("update-ref", "refs/cloud-upload/head", revision);
  await git("reset", "--mixed", "--quiet", revision);
  await rm(join(history, ".git", "hooks"), { recursive: true, force: true });
  await rm(join(history, ".git", "logs"), { recursive: true, force: true });
  return history;
}
