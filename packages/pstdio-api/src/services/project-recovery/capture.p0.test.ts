import { afterEach, test as baseTest, expect } from "bun:test";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryChunkStore, recoveryChunkBytes } from "./chunks";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { createRecoveryPages } from "./pages";

const test = baseTest.skipIf(!nativeRecoverySupported);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-capture-"));
  roots.push(root);
  const folder = join(root, "project");
  await mkdir(folder);
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "owner",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const chunks = await createRecoveryChunkStore({ root: join(root, "recovery"), space });
  const pages = createRecoveryPages(chunks);
  return { root, folder, chunks, pages };
};
const collect = async <T>(input: AsyncIterable<T>) => {
  const result = [];
  for await (const value of input) result.push(value);
  return result;
};

test("folder capture includes hidden, Git, private extension, binary, executable and empty entries under the root policy", async () => {
  const { root, folder, chunks, pages } = await fixture();
  for (const path of [
    "empty",
    ".git/hooks",
    ".pstdio/extension-storage/example.tool",
    "node_modules",
    "nested/node_modules",
  ])
    await mkdir(join(folder, path), { recursive: true });
  await writeFile(join(folder, ".env"), "PRIVATE_RECOVERY_KEY=retained");
  await writeFile(join(folder, ".gitignore"), "*\n");
  await writeFile(join(folder, ".git/hooks/post-checkout"), "#!/bin/sh\nexit 99\n");
  await chmod(join(folder, ".git/hooks/post-checkout"), 0o751);
  await writeFile(join(folder, ".pstdio/extension-storage/example.tool/draft"), "private draft");
  await writeFile(join(folder, "binary"), new Uint8Array([0, 255, 128, 1]));
  await writeFile(join(folder, "node_modules/excluded"), "not part of capture");
  await writeFile(join(root, "outside"), "must not be followed");
  await symlink("../outside", join(folder, "external"));
  const captured = await captureRecoveryFolder({ root: folder, chunks, firstEnrollment: true });
  const entries = await collect(pages.entries(captured.inventory));
  expect(entries.map((entry) => entry.path)).toEqual(
    expect.arrayContaining([
      ".env",
      ".gitignore",
      ".git/hooks/post-checkout",
      ".pstdio/extension-storage/example.tool/draft",
      "binary",
      "empty",
      "external",
      ".pstignore",
    ]),
  );
  expect(entries.some((entry) => entry.path.startsWith("node_modules/"))).toBe(false);
  expect(entries.find((entry) => entry.path === "external")).toMatchObject({ kind: "symlink", target: "../outside" });
  expect(entries.find((entry) => entry.path === ".git/hooks/post-checkout")).toMatchObject({ mode: 0o751 });
  expect(captured.policy).toBe("node_modules/\n");
  expect(await collect(pages.exclusions(captured.exclusions))).toEqual(
    expect.arrayContaining([
      { path: "node_modules", rule: "node_modules/" },
      { path: "nested/node_modules", rule: "node_modules/" },
    ]),
  );
  for (const name of await readdir(chunks.directory)) {
    const bytes = await readFile(join(chunks.directory, name));
    expect(bytes.includes(Buffer.from("PRIVATE_RECOVERY_KEY"))).toBe(false);
  }
});

test("bounded reads preserve a multi-chunk binary file and a deliberately absent policy", async () => {
  const { folder, chunks, pages } = await fixture();
  const bytes = new Uint8Array(recoveryChunkBytes + 17).fill(179);
  await writeFile(join(folder, "large"), bytes);
  const captured = await captureRecoveryFolder({ root: folder, chunks });
  expect(captured.policy).toBeNull();
  const entry = (await collect(pages.entries(captured.inventory))).find((entry) => entry.path === "large");
  if (entry?.kind !== "file") throw new Error("Missing captured file");
  const parts = await collect(pages.parts(entry.content));
  expect(parts.map((part) => part.byteLength)).toEqual([recoveryChunkBytes, 17]);
  const recovered = Buffer.concat(await Promise.all(parts.map((part) => chunks.read(part))));
  expect(new Uint8Array(recovered)).toEqual(bytes);
  expect(captured.bytes).toBe(bytes.length);
});

test("capture refuses an overlapping cache and included files changed during their bounded read", async () => {
  const { folder, chunks } = await fixture();
  await expect(captureRecoveryFolder({ root: chunks.directory, chunks })).rejects.toThrow();
  await writeFile(join(folder, "changing"), new Uint8Array(recoveryChunkBytes + 1));
  let changed = false;
  await expect(
    captureRecoveryFolder({
      root: folder,
      chunks,
      progress: async (event) => {
        if (event.kind === "read" && !changed) {
          changed = true;
          await writeFile(join(folder, "changing"), "changed while capturing");
        }
      },
    }),
  ).rejects.toMatchObject({ code: "recovery_capture_incomplete", path: "changing" });
  expect(changed).toBe(true);
});

test("a later capture reuses unchanged files by source identity and reads changed files again", async () => {
  const { folder, chunks, pages } = await fixture();
  await writeFile(join(folder, "unchanged"), "same bytes");
  await writeFile(join(folder, "edited"), "before");
  const racy: string[] = [];
  await captureRecoveryFolder({ root: folder, chunks });
  // Files written moments before a scan can change again within one timestamp tick.
  await captureRecoveryFolder({ root: folder, chunks, progress: (event) => void racy.push(event.path) });
  expect(racy.sort()).toEqual(["edited", "unchanged"]);
  await Bun.sleep(2_100);
  await captureRecoveryFolder({ root: folder, chunks });
  await writeFile(join(folder, "edited"), "after the edit");
  const read: string[] = [];
  const second = await captureRecoveryFolder({
    root: folder,
    chunks,
    progress: (event) => {
      read.push(event.path);
    },
  });
  expect(read).toEqual(["edited"]);
  const contents: Record<string, string> = {};
  for await (const entry of pages.entries(second.inventory)) {
    if (entry.kind !== "file") continue;
    const parts: Uint8Array[] = [];
    for await (const part of pages.parts(entry.content)) parts.push(await chunks.read(part));
    contents[entry.path] = Buffer.concat(parts).toString();
  }
  expect(contents).toEqual({ unchanged: "same bytes", edited: "after the edit" });
  expect(second).toMatchObject({ files: 2, bytes: "same bytes".length + "after the edit".length });
});
