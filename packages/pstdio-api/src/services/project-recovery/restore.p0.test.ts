import { afterEach, test as baseTest, expect } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryChunkStore, recoveryChunkBytes } from "./chunks";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { createRecoveryPages, type RecoveryEntry } from "./pages";
import { restoreRecoveryCapture } from "./restore";
import { createRecoveryStagingJournal } from "./restore-staging";
import { prepareRecoveryCapture } from "./transfer";

const test = baseTest.skipIf(!nativeRecoverySupported);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await chmod(root, 0o700).catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
});
const fixture = async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "recovery-restore-")));
  roots.push(root);
  const folder = join(root, "project");
  await mkdir(folder);
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "owner",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const chunks = await createRecoveryChunkStore({ root: join(root, "recovery"), space });
  const capture = async (gitRoots: string[] = []) =>
    prepareRecoveryCapture({
      chunks,
      source: { id: "workspace", deviceId: "laptop", name: "Laptop", folder },
      capture: await captureRecoveryFolder({ root: folder, chunks, gitRoots }),
    });
  const restore = (candidate: Awaited<ReturnType<typeof capture>>, destination: string, signal?: AbortSignal) =>
    restoreRecoveryCapture({ chunks, root: candidate, destination, workRoot: join(root, "recovery"), signal });
  return { root, folder, chunks, capture, restore };
};
const git = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", "-c", "init.defaultBranch=main", ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    },
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString();
};
const tree = async (folder: string, prefix = ""): Promise<Record<string, unknown>> => {
  const result: Record<string, unknown> = {};
  for (const name of (await readdir(join(folder, prefix))).sort()) {
    const path = prefix ? `${prefix}/${name}` : name;
    const info = await lstat(join(folder, path));
    const mode = info.mode & 0o7777;
    if (info.isSymbolicLink()) result[path] = { link: await readlink(join(folder, path)) };
    else if (info.isDirectory()) {
      result[path] = { directory: mode };
      Object.assign(result, await tree(folder, path));
    } else
      result[path] = {
        mode,
        sha256: createHash("sha256")
          .update(await readFile(join(folder, path)))
          .digest("hex"),
      };
  }
  return result;
};
const siblings = async (root: string) => (await readdir(root)).filter((name) => name.includes("pstdio-restore"));

test("a restore reproduces every included byte, empty entry, mode and link text without Git", async () => {
  const { root, folder, capture, restore } = await fixture();
  await mkdir(join(folder, "empty"));
  await mkdir(join(folder, "private"), { mode: 0o750 });
  await chmod(join(folder, "private"), 0o750);
  await writeFile(join(folder, ".env"), "SECRET=retained");
  await writeFile(join(folder, "private/run.sh"), "#!/bin/sh\necho hi\n");
  await chmod(join(folder, "private/run.sh"), 0o751);
  await writeFile(join(folder, "empty-file"), "");
  const large = new Uint8Array(recoveryChunkBytes * 2 + 17).map((_, index) => (index * 31) % 251);
  await writeFile(join(folder, "large.bin"), large);
  await writeFile(join(root, "outside"), "never followed");
  await symlink("../outside", join(folder, "external"));
  await symlink("/absolute/elsewhere", join(folder, "absolute"));
  const candidate = await capture();

  const destination = join(root, "restored");
  const result = await restore(candidate, destination);
  expect(result).toEqual({ path: destination, git: "none", rewritten: [], omitted: [] });
  expect(await tree(destination)).toEqual(await tree(folder));
  expect((await stat(destination)).mode & 0o7777).toBe((await stat(folder)).mode & 0o7777);
  expect(await readlink(join(destination, "external"))).toBe("../outside");
  expect(await readFile(join(root, "outside"), "utf8")).toBe("never followed");
  expect(await siblings(root)).toEqual([]);
});

test("a restore keeps the applied .pstignore and leaves excluded paths out", async () => {
  const { root, folder, capture, restore } = await fixture();
  await mkdir(join(folder, "nested/node_modules/package"), { recursive: true });
  await mkdir(join(folder, "dist"));
  await writeFile(join(folder, "nested/node_modules/package/index.js"), "excluded");
  await writeFile(join(folder, "dist/bundle.js"), "excluded");
  await writeFile(join(folder, "dist/keep.js"), "re-included");
  await writeFile(join(folder, ".pstignore"), "node_modules/\ndist/*\n!dist/keep.js\n");
  const destination = join(root, "restored");
  await restore(await capture(), destination);
  expect(await readFile(join(destination, ".pstignore"), "utf8")).toBe("node_modules/\ndist/*\n!dist/keep.js\n");
  expect(await readdir(join(destination, "nested"))).toEqual([]);
  expect(await readdir(join(destination, "dist"))).toEqual(["keep.js"]);

  // Deliberate absence is part of the copy: nothing creates a policy on restore.
  await rm(join(folder, ".pstignore"));
  const absent = join(root, "absent");
  await restore(await capture(), absent);
  await expect(lstat(join(absent, ".pstignore"))).rejects.toThrow();
  expect(await readFile(join(absent, "nested/node_modules/package/index.js"), "utf8")).toBe("excluded");
});

test("a .pstignore with a byte-order mark restores byte for byte and keeps its rules", async () => {
  const { root, folder, capture, restore } = await fixture();
  await mkdir(join(folder, "dist"));
  await writeFile(join(folder, "dist/bundle.js"), "excluded");
  await writeFile(join(folder, "kept.txt"), "kept");
  await writeFile(join(folder, ".pstignore"), "\uFEFFdist/\n");
  const destination = join(root, "restored");
  await restore(await capture(), destination);
  expect(await readFile(join(destination, ".pstignore"), "utf8")).toBe("\uFEFFdist/\n");
  expect((await readdir(destination)).sort()).toEqual([".pstignore", "kept.txt"]);
});

test("an existing destination is refused without writes, even an empty folder or a link", async () => {
  const { root, folder, capture, restore } = await fixture();
  await writeFile(join(folder, "file"), "copy");
  const candidate = await capture();
  await mkdir(join(root, "empty"));
  await symlink(join(root, "elsewhere"), join(root, "link"));
  await expect(restore(candidate, join(root, "empty"))).rejects.toMatchObject({ code: "destination_exists" });
  await expect(restore(candidate, join(root, "link"))).rejects.toMatchObject({ code: "destination_exists" });
  await expect(restore(candidate, join(root, "missing/parent"))).rejects.toMatchObject({
    code: "destination_parent_missing",
  });
  expect(await readdir(join(root, "empty"))).toEqual([]);
  await expect(lstat(join(root, "elsewhere"))).rejects.toThrow();
  expect(await siblings(root)).toEqual([]);
});

test("a destination created during the restore is kept and the restore attaches nothing", async () => {
  const { root, folder, chunks, capture } = await fixture();
  for (let index = 0; index < 5; index++) await writeFile(join(folder, `file-${index}`), `copy ${index}`);
  const candidate = await capture();
  const destination = join(root, "restored");
  let raced = false;
  const restoring = restoreRecoveryCapture({
    chunks,
    root: candidate,
    destination,
    workRoot: join(root, "recovery"),
    progress: async ({ files }) => {
      if (files !== 2 || raced) return;
      raced = true;
      await mkdir(destination);
      await writeFile(join(destination, "local-work"), "created by another program");
    },
  });
  await expect(restoring).rejects.toMatchObject({ code: "destination_created" });
  expect(await readdir(destination)).toEqual(["local-work"]);
  expect(await readFile(join(destination, "local-work"), "utf8")).toBe("created by another program");
  expect(await siblings(root)).toEqual([]);
});

test("cancelling a restore removes its staging folder and leaves no destination", async () => {
  const { root, folder, chunks, capture } = await fixture();
  await mkdir(join(folder, "readonly"));
  for (let index = 0; index < 5; index++) await writeFile(join(folder, `readonly/file-${index}`), `copy ${index}`);
  await chmod(join(folder, "readonly"), 0o500);
  const candidate = await capture();
  await chmod(join(folder, "readonly"), 0o700);
  const controller = new AbortController();
  const restoring = restoreRecoveryCapture({
    chunks,
    root: candidate,
    destination: join(root, "restored"),
    workRoot: join(root, "recovery"),
    signal: controller.signal,
    progress: ({ files }) => {
      if (files === 3) controller.abort();
    },
  });
  await expect(restoring).rejects.toThrow();
  expect(controller.signal.aborted).toBe(true);
  await expect(lstat(join(root, "restored"))).rejects.toThrow();
  expect(await siblings(root)).toEqual([]);
  expect(await readdir(join(root, "recovery", "restores")).catch(() => [])).toEqual([]);
});

/** A copy whose inventory was crafted, as a compromised device or relay could try. */
const crafted = async (entries: RecoveryEntry[]) => {
  const { root, chunks, restore } = await fixture();
  const pages = createRecoveryPages(chunks);
  const inventory = pages.inventory();
  let files = 0;
  let bytes = 0;
  for (const entry of entries) {
    if (entry.kind === "file") {
      const content = new TextEncoder().encode("x".repeat(entry.size));
      const parts = pages.file();
      if (content.length) await parts.add(await chunks.stage(content));
      await inventory.add({
        ...entry,
        sha256: createHash("sha256").update(content).digest("hex"),
        content: await parts.finish(),
      });
      files++;
      bytes += entry.size;
    } else await inventory.add(entry);
  }
  const now = new Date().toISOString();
  const candidate = await prepareRecoveryCapture({
    chunks,
    source: { id: "workspace", deviceId: "laptop", name: "Laptop", folder: "/source" },
    capture: {
      inventory: await inventory.finish(),
      exclusions: null,
      policy: null,
      rootMode: 0o755,
      files,
      bytes,
      git: { state: "none", dependencies: [], problems: [] },
      startedAt: now,
      completedAt: now,
    },
  });
  return { root, restore: (path = join(root, "restored")) => restore(candidate, path) };
};
const file = (path: string, size = 1) => ({
  kind: "file" as const,
  path,
  mode: 0o644,
  size,
  sha256: "",
  content: null,
});

test("a copy that writes through a restored link, outside its folders or twice is refused before staging", async () => {
  for (const entries of [
    [{ kind: "symlink" as const, path: "link", mode: 0o755, target: ".." }, file("link/escape")],
    [file("missing-parent/file")],
    [file("twice"), file("twice")],
  ]) {
    const { root, restore } = await crafted(entries);
    await expect(restore()).rejects.toMatchObject({ code: "unsafe_entry" });
    expect((await readdir(root)).sort()).toEqual(["project", "recovery"]);
  }
  // Traversal never parses as an entry at all.
  await expect(crafted([file("../escape")])).rejects.toThrow();
});

test("names that collide on the destination filesystem are refused and nothing is attached", async () => {
  const { root, restore } = await crafted([file("Readme"), file("README")]);
  const caseInsensitive = await (async () => {
    await writeFile(join(root, "probe"), "");
    return lstat(join(root, "PROBE")).then(
      () => true,
      () => false,
    );
  })();
  if (caseInsensitive) {
    await expect(restore()).rejects.toMatchObject({ code: "name_collision", path: "README" });
    await expect(lstat(join(root, "restored"))).rejects.toThrow();
    expect(await siblings(root)).toEqual([]);
  } else expect((await readdir((await restore()).path)).sort()).toEqual(["README", "Readme"]);
});

test("a repository restores as working Git with staged, unpushed and hook state, without running hooks", async () => {
  const { root, folder, capture, restore } = await fixture();
  git(folder, "init", "-q");
  await writeFile(join(folder, "tracked"), "committed");
  git(folder, "add", "tracked");
  git(folder, "commit", "-qm", "first");
  git(folder, "commit", "-q", "--allow-empty", "-m", "unpushed");
  await writeFile(join(folder, "tracked"), "staged edit");
  git(folder, "add", "tracked");
  await writeFile(join(folder, "tracked"), "saved but unstaged");
  await writeFile(join(folder, ".git/hooks/post-checkout"), `#!/bin/sh\ntouch ${join(root, "hook-ran")}\n`);
  await chmod(join(folder, ".git/hooks/post-checkout"), 0o755);
  const destination = join(root, "restored");
  const result = await restore(await capture([folder]), destination);
  expect(result.git).toBe("functional");
  expect(git(destination, "log", "--format=%s")).toBe("unpushed\nfirst\n");
  expect(git(destination, "diff", "--cached")).toBe(git(folder, "diff", "--cached"));
  expect(git(destination, "status", "--porcelain")).toBe(git(folder, "status", "--porcelain"));
  expect(git(destination, "fsck", "--no-progress")).toBe("");
  await expect(lstat(join(root, "hook-ran"))).rejects.toThrow();
});

test("a linked worktree restores its registered administration inside the folder with no source paths", async () => {
  const { root, folder, chunks, restore } = await fixture();
  const repository = join(root, "repository");
  await mkdir(repository);
  git(repository, "init", "-q");
  await writeFile(join(repository, "tracked"), "committed");
  git(repository, "add", "tracked");
  git(repository, "commit", "-qm", "first");
  await rm(folder, { recursive: true });
  git(repository, "worktree", "add", "-q", folder);
  await writeFile(join(folder, "unpushed"), "local work");
  git(folder, "add", "unpushed");
  git(folder, "commit", "-qm", "worktree only");
  const candidate = await prepareRecoveryCapture({
    chunks,
    source: { id: "workspace", deviceId: "laptop", name: "Laptop", folder },
    capture: await captureRecoveryFolder({ root: folder, chunks, gitRoots: [repository] }),
  });
  // The source device's repository is gone; the restored folder must not need it.
  await rm(repository, { recursive: true });
  await rm(folder, { recursive: true });
  const destination = join(root, "restored");
  const result = await restore(candidate, destination);
  expect(result.git).toBe("functional");
  expect(result.rewritten).toEqual(
    expect.arrayContaining([".git", expect.stringMatching(/^\.pstdio\/recovery\/.+\/gitdir$/)]),
  );
  expect(git(destination, "log", "--format=%s")).toBe("worktree only\nfirst\n");
  expect(git(destination, "status", "--porcelain")).toBe("");
  expect(git(destination, "fsck", "--no-progress")).toBe("");
  expect(await readFile(join(destination, ".git"), "utf8")).not.toContain(repository);
});

test("an unregistered worktree restores its files but never claims working Git", async () => {
  const { root, folder, capture, restore } = await fixture();
  const repository = join(root, "repository");
  await mkdir(repository);
  git(repository, "init", "-q");
  git(repository, "commit", "-q", "--allow-empty", "-m", "first");
  await rm(folder, { recursive: true });
  git(repository, "worktree", "add", "-q", folder);
  const result = await restore(await capture([]), join(root, "restored"));
  expect(result.git).toBe("incomplete");
  expect(result.rewritten).toEqual([]);
  expect(result.omitted).toEqual([{ path: ".git", reason: "git-link-outside-folder" }]);
  await expect(lstat(join(root, "restored", ".git"))).rejects.toThrow();
});

test("a worktree whose administration was not restored never shares the source repository", async () => {
  const { root, folder, capture, restore } = await fixture();
  const repository = join(root, "repository");
  await mkdir(repository);
  git(repository, "init", "-q");
  await writeFile(join(repository, "tracked"), "committed");
  git(repository, "add", "tracked");
  git(repository, "commit", "-qm", "first");
  await rm(folder, { recursive: true });
  git(repository, "worktree", "add", "-q", "-b", "work", folder);
  const branch = git(repository, "rev-parse", "work");
  const index = await readFile(join(repository, ".git/worktrees/project/index"));
  // The repository is not registered, so its administration is not part of the copy.
  const destination = join(root, "restored");
  const result = await restore(await capture([]), destination);
  expect(result.git).toBe("incomplete");
  expect(result.omitted).toEqual([{ path: ".git", reason: "git-link-outside-folder" }]);
  await expect(lstat(join(destination, ".git"))).rejects.toThrow();
  await writeFile(join(destination, "tracked"), "changed in the restored folder");
  Bun.spawnSync(["git", "add", "tracked"], { cwd: destination });
  Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "restored"], {
    cwd: destination,
  });
  expect(git(repository, "rev-parse", "work")).toBe(branch);
  expect(await readFile(join(repository, ".git/worktrees/project/index"))).toEqual(index);
  expect(await readFile(join(folder, "tracked"), "utf8")).toBe("committed");
});

test("rebuilt Git administration stays out of commits and a re-captured restored folder restores again", async () => {
  const { root, folder, chunks, restore } = await fixture();
  const repository = join(root, "repository");
  await mkdir(repository);
  git(repository, "init", "-q");
  await writeFile(join(repository, "tracked"), "committed");
  git(repository, "add", "tracked");
  git(repository, "commit", "-qm", "first");
  await rm(folder, { recursive: true });
  git(repository, "worktree", "add", "-q", folder);
  const copy = (from: string, gitRoots: string[]) =>
    captureRecoveryFolder({ root: from, chunks, gitRoots }).then((capture) =>
      prepareRecoveryCapture({
        chunks,
        source: { id: "workspace", deviceId: "laptop", name: "Laptop", folder: from },
        capture,
      }),
    );
  const first = join(root, "first");
  await restore(await copy(folder, [repository]), first);
  expect(git(first, "status", "--porcelain")).toBe("");
  git(first, "add", "-A");
  expect(git(first, "diff", "--cached", "--name-only")).toBe("");

  const second = join(root, "second");
  const again = await restore(await copy(first, []), second);
  expect(again.git).toBe("functional");
  expect(again.omitted).toEqual([]);
  expect(git(second, "log", "--format=%s")).toBe("first\n");
  expect(git(second, "status", "--porcelain")).toBe("");
  const firstHead = git(first, "rev-parse", "HEAD");
  git(second, "commit", "-q", "--allow-empty", "-m", "second only");
  expect(git(first, "rev-parse", "HEAD")).toBe(firstHead);
});

test("restored modes keep permission bits only", async () => {
  const { root, folder, capture, restore } = await fixture();
  await writeFile(join(folder, "tool"), "#!/bin/sh\n");
  await chmod(join(folder, "tool"), 0o4755);
  await mkdir(join(folder, "shared"));
  await chmod(join(folder, "shared"), 0o1777);
  const destination = join(root, "restored");
  await restore(await capture(), destination);
  expect((await stat(join(destination, "tool"))).mode & 0o7777).toBe(0o755);
  expect((await stat(join(destination, "shared"))).mode & 0o7777).toBe(0o777);
});

test("a failed staging cleanup keeps the original error and its journal entry for a later cleanup", async () => {
  const { root, folder, chunks, capture } = await fixture();
  const parent = join(root, "parent");
  await mkdir(parent);
  for (let index = 0; index < 4; index++) await writeFile(join(folder, `file-${index}`), `copy ${index}`);
  const candidate = await capture();
  const controller = new AbortController();
  const restoring = restoreRecoveryCapture({
    chunks,
    root: candidate,
    destination: join(parent, "restored"),
    workRoot: join(root, "recovery"),
    signal: controller.signal,
    progress: async ({ files }) => {
      if (files !== 2) return;
      // The staging folder can no longer be removed from its parent.
      await chmod(parent, 0o500);
      controller.abort(new Error("cancelled by the person"));
    },
  });
  await expect(restoring).rejects.toThrow("cancelled by the person");
  await chmod(parent, 0o700);
  expect(await siblings(parent)).toHaveLength(1);
  expect(await readdir(join(root, "recovery", "restores"))).toHaveLength(1);
  // No restore of this process runs now, so the next cleanup removes it.
  await createRecoveryStagingJournal(join(root, "recovery")).clean();
  expect(await siblings(parent)).toEqual([]);
  expect(await readdir(join(root, "recovery", "restores"))).toEqual([]);
});

test("destination names and paths beyond the platform limits are refused with their own error", async () => {
  const { root, folder, capture, restore } = await fixture();
  const deep = "d".repeat(200);
  await mkdir(join(folder, deep, deep), { recursive: true });
  await writeFile(join(folder, deep, deep, "file"), "deep");
  const candidate = await capture();
  // A long name still fits beside its staging folder.
  await restore(candidate, join(root, "n".repeat(240)));
  await expect(restore(candidate, join(root, "n".repeat(256)))).rejects.toMatchObject({
    code: "destination_too_long",
  });
  const limit = process.platform === "darwin" ? 1024 : 4096;
  let parent = root;
  while (Buffer.byteLength(parent) < limit - 300) parent = join(parent, "p".repeat(100));
  await mkdir(parent, { recursive: true });
  await expect(restore(candidate, join(parent, "restored"))).rejects.toMatchObject({
    code: "destination_too_long",
    path: `${deep}/${deep}/file`,
  });
  expect(await siblings(parent)).toEqual([]);
});
