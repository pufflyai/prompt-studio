import { lstat, mkdtemp, rm, writeFile } from "node:fs/promises";
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
    const path = join(directory, "source.tar.gz");
    const files = ref
      ? await archiveCommit(process, root, revision, path)
      : await archiveTree(process, root, directory, path);
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
  await process.runOrThrow({
    command: ["git", "-C", root, "archive", "--format=tar.gz", "--output", archive, revision],
    timeoutMs: 300_000,
  });
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
    command: ["tar", "-czf", archive, "-C", root, "--null", "-T", list],
    // macOS tar otherwise adds a "._" file per file with extended attributes.
    env: { PATH: globalThis.process.env.PATH ?? "/usr/bin:/bin", COPYFILE_DISABLE: "1" },
    timeoutMs: 300_000,
  });
  return files.length;
}
