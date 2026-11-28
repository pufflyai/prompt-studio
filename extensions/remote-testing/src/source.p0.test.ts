import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localProcess } from "./process-fixture";
import { withSourceArchive } from "./source";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});

// Raw entry names; macOS tar hides "._" entries when it lists an archive.
function entries(archive: Uint8Array<ArrayBuffer>) {
  const tar = Bun.gunzipSync(archive);
  const names: string[] = [];
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const name = new TextDecoder().decode(tar.subarray(offset, offset + 100)).replace(/\0.*$/s, "");
    if (!name) break;
    const size = Number.parseInt(new TextDecoder().decode(tar.subarray(offset + 124, offset + 136)).trim(), 8) || 0;
    const type = String.fromCharCode(tar[offset + 156] ?? 0);
    if (type !== "x" && type !== "g") names.push(name.replace(/^\.\//, ""));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}

async function git(root: string, ...args: string[]) {
  await localProcess.runOrThrow({ command: ["git", "-C", root, ...args] });
}

test("packs uncommitted edits and new files but not ignored or deleted files", async () => {
  const root = await mkdtemp(join(tmpdir(), "remote-testing-source-"));
  directories.push(root);
  await git(root, "init", "-q");
  await writeFile(join(root, ".gitignore"), "node_modules\n");
  await writeFile(join(root, "kept.txt"), "committed");
  await writeFile(join(root, "removed.txt"), "committed");
  await git(root, "add", ".");
  await git(root, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
  await writeFile(join(root, "kept.txt"), "edited");
  // macOS tar turns extended attributes into "._" files that test runners pick up.
  if (process.platform === "darwin")
    await localProcess.runOrThrow({ command: ["xattr", "-w", "com.example.note", "1", join(root, "kept.txt")] });
  await rm(join(root, "removed.txt"));
  await writeFile(join(root, "new.txt"), "untracked");
  await mkdir(join(root, "node_modules/pkg"), { recursive: true });
  await writeFile(join(root, "node_modules/pkg/index.js"), "ignored");

  const packed = await withSourceArchive(localProcess, root, undefined, async ({ archive, files, sha256 }) => ({
    bytes: await archive.bytes(),
    files,
    sha256,
  }));

  const out = await mkdtemp(join(tmpdir(), "remote-testing-unpacked-"));
  directories.push(out);
  await writeFile(join(out, "source.tar.gz"), packed.bytes);
  expect(
    entries(packed.bytes)
      .filter((name) => !name.startsWith(".git/"))
      .sort(),
  ).toEqual([".gitignore", "kept.txt", "new.txt"]);
  await localProcess.runOrThrow({ command: ["tar", "-xzf", join(out, "source.tar.gz"), "-C", out] });
  expect(await Bun.file(join(out, "kept.txt")).text()).toBe("edited");
  expect(packed.files).toBe(3);
  expect(packed.sha256).toMatch(/^[0-9a-f]{64}$/);
  const history = await localProcess.runOrThrow({ command: ["git", "-C", out, "show", "HEAD:kept.txt"] });
  expect(history.stdout.trim()).toBe("committed");
  const status = await localProcess.runOrThrow({ command: ["git", "-C", out, "status", "--porcelain"] });
  expect(status.stdout).toContain("kept.txt");
});

test("keeps the committed branch archive available while it is in use", async () => {
  const root = await mkdtemp(join(tmpdir(), "remote-testing-ref-"));
  directories.push(root);
  await git(root, "init", "-q");
  await writeFile(join(root, "branch.txt"), "committed");
  await writeFile(join(root, ".gitattributes"), "branch.txt export-ignore\n");
  await git(root, "add", ".");
  await git(root, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
  await git(root, "branch", "agent/preview");
  await writeFile(join(root, "branch.txt"), "dirty");
  await writeFile(join(root, "untracked.txt"), "local only");
  const out = await mkdtemp(join(tmpdir(), "remote-testing-unpacked-"));
  directories.push(out);

  const template = await mkdtemp(join(tmpdir(), "remote-testing-git-template-"));
  directories.push(template);
  await writeFile(join(template, "config"), "[credential]\nhelper = host-private-marker\n");
  await writeFile(join(template, "private-file"), "host-private-marker");
  const hostProcess = {
    ...localProcess,
    runOrThrow: (input: Parameters<typeof localProcess.runOrThrow>[0]) =>
      localProcess.runOrThrow({ ...input, env: { ...process.env, ...input.env, GIT_TEMPLATE_DIR: template } }),
  };
  const { path, sha256 } = await withSourceArchive(hostProcess, root, "agent/preview", async (source) => {
    const bytes = await source.archive.bytes();
    expect(entries(bytes).filter((name) => !name.startsWith(".git/"))).toEqual([".gitattributes", "branch.txt"]);
    expect(source.sha256).toBe(new Bun.CryptoHasher("sha256").update(bytes).digest("hex"));
    const path = source.archive.name;
    if (!path) throw new Error("Expected a file-backed archive.");
    await localProcess.runOrThrow({ command: ["tar", "-xzf", path, "-C", out] });
    expect(await Bun.file(join(out, "branch.txt")).text()).toBe("committed");
    expect(await Bun.file(join(out, ".git", "config")).text()).not.toContain("host-private-marker");
    expect(await Bun.file(join(out, ".git", "private-file")).exists()).toBe(false);
    expect(source.revision).toMatch(/^[0-9a-f]{40}$/);
    return { path, sha256: source.sha256 };
  });

  expect(await Bun.file(path).exists()).toBe(false);
  expect(sha256).toMatch(/^[0-9a-f]{64}$/);
});

test("uploads the selected comparison history without unrelated workspace branches", async () => {
  const root = await mkdtemp(join(tmpdir(), "remote-testing-comparison-"));
  directories.push(root);
  const run = async (...args: string[]) =>
    (await localProcess.runOrThrow({ command: ["git", "-C", root, ...args] })).stdout.trim();
  await run("init", "--template=", "-q");
  await writeFile(join(root, "file.txt"), "candidate");
  await run("add", ".");
  await run("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "candidate");
  const tree = await run("rev-parse", "HEAD^{tree}");
  const commit = async (message: string) =>
    run("-c", "user.name=t", "-c", "user.email=t@example.com", "commit-tree", tree, "-m", message);
  const base = await commit("comparison");
  await run("update-ref", "refs/custom/release", base);
  await run("update-ref", "refs/heads/unrelated-workspace", await commit("unrelated"));
  const out = await mkdtemp(join(tmpdir(), "remote-testing-comparison-out-"));
  directories.push(out);
  await withSourceArchive(
    localProcess,
    root,
    "HEAD",
    async ({ archive }) => {
      await localProcess.runOrThrow({ command: ["tar", "-xzf", archive.name!, "-C", out] });
      const selected = await localProcess.runOrThrow({
        command: ["git", "-C", out, "rev-parse", "refs/custom/release"],
      });
      expect(selected.stdout.trim()).toBe(base);
      const omitted = await localProcess.run({
        command: ["git", "-C", out, "show-ref", "--verify", "refs/heads/unrelated-workspace"],
      });
      expect(omitted.exitCode).not.toBe(0);
    },
    "refs/custom/release",
  );
});
