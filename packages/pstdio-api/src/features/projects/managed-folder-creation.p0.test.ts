import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectRejection } from "../../test-utils/expect-rejection";
import {
  inspectManagedProjectFolder,
  prepareManagedProjectFolder,
  removeManagedProjectFolder,
} from "./managed-project-folder";

const fixture = async (run: (input: { root: string; folder: string; record: string; id: string }) => Promise<void>) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "managed-creation-recovery-")));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const id = "recover-creation";
  const folder = join(root, "projects", `project-${id}`);
  const record = join(root, "project-folder-ownership", `project-${id}`);
  try {
    await mkdir(join(root, "projects"), { recursive: true });
    await mkdir(join(root, "project-folder-ownership"), { recursive: true });
    await run({ root, folder, record, id });
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
};
const receipt = async (record: string, directory: string, identity: string | null) =>
  writeFile(`${record}.creation`, JSON.stringify({ version: 1, directory, identity }));
const identity = async (path: string) => {
  const found = await lstat(path, { bigint: true });
  return `${String(found.dev)}:${String(found.ino)}`;
};

test("an interrupted empty staging reservation is safely recreated and completed", () =>
  fixture(async ({ root, folder, record, id }) => {
    const directory = crypto.randomUUID();
    const stage = join(root, "projects", `.project-creation-${directory}`);
    await receipt(record, directory, null);
    await mkdir(stage);
    const prepared = await prepareManagedProjectFolder(id);
    expect(await inspectManagedProjectFolder(id, prepared)).toEqual({ removesManagedFolder: true });
    expect(await readFile(record, "utf8")).toBe(await identity(folder));
    await expectRejection(lstat(stage)).toMatchObject({ code: "ENOENT" });
    await expectRejection(lstat(`${record}.creation`)).toMatchObject({ code: "ENOENT" });
  }));

test("an unverified nonempty staging reservation is retained", () =>
  fixture(async ({ root, folder, record, id }) => {
    const directory = crypto.randomUUID();
    const stage = join(root, "projects", `.project-creation-${directory}`);
    await receipt(record, directory, null);
    await mkdir(stage);
    await writeFile(join(stage, "local"), "Do not discard unverified files");
    await expectRejection(prepareManagedProjectFolder(id)).toBeDefined();
    expect(await readFile(join(stage, "local"), "utf8")).toBe("Do not discard unverified files");
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });
    expect(await readFile(`${record}.creation`, "utf8")).toContain(directory);
  }));

test("a destination created before publication remains unverified and unchanged", () =>
  fixture(async ({ folder, record, id }) => {
    const move = fs.rename;
    let collision: string | undefined;
    const moving = spyOn(fs, "rename").mockImplementation(async (from, to) => {
      await move(from, to);
      if (
        String(to) === `${record}.creation` &&
        !collision &&
        JSON.parse(await readFile(String(to), "utf8")).identity
      ) {
        await mkdir(folder);
        collision = await identity(folder);
      }
    });
    try {
      const prepared = await prepareManagedProjectFolder(id);
      expect(collision).toBeDefined();
      expect(await identity(folder)).toBe(collision!);
      expect(await inspectManagedProjectFolder(id, prepared)).toEqual({
        removesManagedFolder: false,
        retainsUnverifiedFolder: true,
      });
      await expectRejection(lstat(record)).toMatchObject({ code: "ENOENT" });
    } finally {
      moving.mockRestore();
    }
  }));

test("a replacement is never adopted from the previous creation receipt", () =>
  fixture(async ({ root, folder, record, id }) => {
    await mkdir(folder);
    await writeFile(join(folder, "owned"), "Retain the moved original");
    await receipt(record, crypto.randomUUID(), await identity(folder));
    await rename(folder, join(root, "moved-original"));
    await mkdir(folder);
    await writeFile(join(folder, "local"), "User replacement");
    const prepared = await prepareManagedProjectFolder(id);
    expect(await inspectManagedProjectFolder(id, prepared)).toEqual({
      removesManagedFolder: false,
      retainsUnverifiedFolder: true,
    });
    await removeManagedProjectFolder(id, prepared);
    expect(await readFile(join(folder, "local"), "utf8")).toBe("User replacement");
    expect(await readFile(join(root, "moved-original", "owned"), "utf8")).toBe("Retain the moved original");
  }));

test("removal accepts a verified published creation before the final marker exists", () =>
  fixture(async ({ folder, record, id }) => {
    await mkdir(folder);
    await writeFile(join(folder, "owned"), "App-owned copy");
    await receipt(record, crypto.randomUUID(), await identity(folder));
    expect(await inspectManagedProjectFolder(id, await realpath(folder))).toEqual({ removesManagedFolder: true });
    await removeManagedProjectFolder(id, await realpath(folder));
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });
    await expectRejection(lstat(`${record}.creation`)).toMatchObject({ code: "ENOENT" });
  }));

test("a disappearing existing destination is not silently recreated without ownership", () =>
  fixture(async ({ folder, id }) => {
    await mkdir(folder);
    const stat = fs.lstat;
    let removed = false;
    const reading = spyOn(fs, "lstat").mockImplementation((async (...args: Parameters<typeof fs.lstat>) => {
      const value = await stat(...args);
      if (args[0] === folder && !removed) {
        removed = true;
        await rm(folder, { recursive: true });
      }
      return value;
    }) as typeof fs.lstat);
    try {
      await expectRejection(prepareManagedProjectFolder(id)).toMatchObject({ code: "ENOENT" });
      await expectRejection(stat(folder)).toMatchObject({ code: "ENOENT" });
    } finally {
      reading.mockRestore();
    }
  }));

test("removal never records an identity different from its ownership proof", () =>
  fixture(async ({ root, folder, record, id }) => {
    const prepared = await prepareManagedProjectFolder(id);
    const original = join(root, "owned-original");
    const replacement = join(root, "user-replacement");
    await rename(folder, original);
    await mkdir(folder);
    await writeFile(join(folder, "local"), "Retain unverified user data");
    const stat = fs.lstat;
    const read = fs.readFile;
    let swapped = false;
    let restored = false;
    const readingIdentity = spyOn(fs, "lstat").mockImplementation((async (...args: Parameters<typeof fs.lstat>) => {
      const value = await stat(...args);
      if (args[0] === folder && !swapped) {
        swapped = true;
        await rename(folder, replacement);
        await rename(original, folder);
      }
      return value;
    }) as typeof fs.lstat);
    const readingMarker = spyOn(fs, "readFile").mockImplementation((async (...args: Parameters<typeof fs.readFile>) => {
      const value = await read(...args);
      if (args[0] === record && swapped && !restored) {
        restored = true;
        await rename(folder, original);
        await rename(replacement, folder);
      }
      return value;
    }) as typeof fs.readFile);
    try {
      await removeManagedProjectFolder(id, prepared);
      expect(await read(join(folder, "local"), "utf8")).toBe("Retain unverified user data");
      await expectRejection(stat(`${record}.removal`)).toMatchObject({ code: "ENOENT" });
    } finally {
      readingIdentity.mockRestore();
      readingMarker.mockRestore();
    }
  }));

test.each([
  "marker",
  "receipt",
  "stage",
] as const)("unfinished %s creation prevents eviction before the workspace root is bound", (phase) =>
  fixture(async ({ root, folder, record, id }) => {
    const directory = crypto.randomUUID();
    const stage = join(root, "projects", `.project-creation-${directory}`);
    if (phase === "marker") await prepareManagedProjectFolder(id);
    else if (phase === "receipt") {
      await mkdir(folder);
      await receipt(record, directory, await identity(folder));
    } else {
      await mkdir(stage);
      await receipt(record, directory, null);
    }
    await expectRejection(removeManagedProjectFolder(id, null)).toThrow("incomplete");
    if (phase === "marker") expect(await readFile(record, "utf8")).toBe(await identity(folder));
    else expect(await readFile(`${record}.creation`, "utf8")).toContain(directory);
    expect((await lstat(phase === "stage" ? stage : folder)).isDirectory()).toBe(true);
  }));

test("successful removal clears an interrupted first receipt write", () =>
  fixture(async ({ record, id }) => {
    await writeFile(`${record}.creation.pending`, "Interrupted write");
    await writeFile(`${record}.pending`, "Interrupted marker write");
    await removeManagedProjectFolder(id, null);
    await expectRejection(lstat(`${record}.creation.pending`)).toMatchObject({ code: "ENOENT" });
    await expectRejection(lstat(`${record}.pending`)).toMatchObject({ code: "ENOENT" });
  }));

test("an alternate bound folder can evict a safely empty abandoned creation stage", () =>
  fixture(async ({ root, folder, record, id }) => {
    const directory = crypto.randomUUID();
    const stage = join(root, "projects", `.project-creation-${directory}`);
    const alternate = join(root, "chosen-folder");
    await mkdir(stage);
    await receipt(record, directory, null);
    await mkdir(alternate);
    await writeFile(join(alternate, "local"), "Keep the chosen folder");
    await removeManagedProjectFolder(id, alternate);
    expect(await readFile(join(alternate, "local"), "utf8")).toBe("Keep the chosen folder");
    await expectRejection(lstat(stage)).toMatchObject({ code: "ENOENT" });
    await expectRejection(lstat(`${record}.creation`)).toMatchObject({ code: "ENOENT" });
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });
  }));

test("an alternate bound folder preserves user data while removing a receipt-proven managed copy", () =>
  fixture(async ({ root, folder, record, id }) => {
    await mkdir(folder);
    await writeFile(join(folder, "owned"), "App-owned interrupted creation");
    await receipt(record, crypto.randomUUID(), await identity(folder));
    const alternate = join(root, "chosen-folder");
    await mkdir(alternate);
    await writeFile(join(alternate, "local"), "Keep the chosen folder");
    await removeManagedProjectFolder(id, alternate);
    expect(await readFile(join(alternate, "local"), "utf8")).toBe("Keep the chosen folder");
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });
    await expectRejection(lstat(`${record}.creation`)).toMatchObject({ code: "ENOENT" });
  }));
