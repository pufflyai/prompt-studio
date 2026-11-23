import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectRejection } from "../../test-utils/expect-rejection";
import {
  inspectManagedProjectFolder,
  prepareManagedProjectFolder,
  removeManagedProjectFolder,
} from "./managed-project-folder";

test("a failed ownership record can be retried without leaving an unowned app-created folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-folder-ownership-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const id = "downloaded-project";
  const folder = join(root, "projects", `project-${id}`);
  const ownership = join(root, "project-folder-ownership");
  try {
    await mkdir(join(ownership, `project-${id}`), { recursive: true });
    await expectRejection(prepareManagedProjectFolder(id)).toBeDefined();
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });
    await rm(join(ownership, `project-${id}`), { recursive: true });
    const prepared = await prepareManagedProjectFolder(id);
    expect(await inspectManagedProjectFolder(id, prepared)).toEqual({ removesManagedFolder: true });
    await removeManagedProjectFolder(id, prepared);
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });
    await mkdir(folder);
    await writeFile(join(folder, "user.txt"), "Keep pre-existing files");
    await prepareManagedProjectFolder(id);
    await removeManagedProjectFolder(id, prepared);
    expect(await readFile(join(folder, "user.txt"), "utf8")).toBe("Keep pre-existing files");
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("managed cleanup preserves a replacement created at the original path", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-folder-replacement-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const id = "replaced-project";
  const folder = join(root, "projects", `project-${id}`);
  const prepared = await prepareManagedProjectFolder(id);
  await writeFile(join(folder, "owned.txt"), "App-owned contents");
  const rename = fs.rename;
  const remove = fs.rm;
  let replaced = false;
  const replacement = async () => {
    replaced = true;
    await mkdir(folder);
    await writeFile(join(folder, "user.txt"), "Retain unrelated data");
  };
  const moving = spyOn(fs, "rename").mockImplementation(async (from, to) => {
    await rename(from, to);
    if (from === folder) await replacement();
  });
  const deleting = spyOn(fs, "rm").mockImplementation(async (path, options) => {
    if (path === folder && options?.recursive) {
      await rename(folder, join(root, "original"));
      await replacement();
    }
    await remove(path, options);
  });
  try {
    await removeManagedProjectFolder(id, prepared);
    expect(replaced).toBe(true);
    expect(await readFile(join(folder, "user.txt"), "utf8")).toBe("Retain unrelated data");
  } finally {
    moving.mockRestore();
    deleting.mockRestore();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("interrupted cleanup resumes its claimed folder and leaves a replacement intact", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-folder-interrupted-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const id = "interrupted-project";
  const folder = join(root, "projects", `project-${id}`);
  const prepared = await prepareManagedProjectFolder(id);
  await writeFile(join(folder, "owned.txt"), "Owned contents");
  const remove = fs.rm;
  let claimedPath: string | URL | Buffer | undefined;
  const deleting = spyOn(fs, "rm").mockImplementation(async (path, options) => {
    if (options?.recursive) {
      claimedPath = path;
      throw new Error("Interrupted deletion");
    }
    await remove(path, options);
  });
  try {
    await expectRejection(removeManagedProjectFolder(id, prepared)).toThrow("Interrupted deletion");
    deleting.mockRestore();
    await expectRejection(prepareManagedProjectFolder(id)).toThrow("cleanup is incomplete");
    expect(claimedPath).not.toBe(folder);
    expect(await readFile(join(String(claimedPath), "owned.txt"), "utf8")).toBe("Owned contents");
    await mkdir(folder);
    await writeFile(join(folder, "user.txt"), "Replacement survives retry");
    await removeManagedProjectFolder(id, prepared);
    expect(await readFile(join(folder, "user.txt"), "utf8")).toBe("Replacement survives retry");
    await expectRejection(lstat(String(claimedPath))).toMatchObject({ code: "ENOENT" });
  } finally {
    deleting.mockRestore();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("a folder replaced just before claiming is retained and cleanup reports incomplete", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-folder-claim-race-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const id = "claim-race-project";
  const folder = join(root, "projects", `project-${id}`);
  const prepared = await prepareManagedProjectFolder(id);
  await writeFile(join(folder, "owned.txt"), "Original contents");
  const rename = fs.rename;
  let claimedPath: string | URL | Buffer | undefined;
  const moving = spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (from === folder) {
      await rename(folder, join(root, "original"));
      await mkdir(folder);
      await writeFile(join(folder, "user.txt"), "Retain this replacement");
      claimedPath = to;
    }
    await rename(from, to);
  });
  try {
    await expectRejection(removeManagedProjectFolder(id, prepared)).toThrow("Files were retained");
    expect(await readFile(join(String(claimedPath), "user.txt"), "utf8")).toBe("Retain this replacement");
    expect(await readFile(join(root, "original", "owned.txt"), "utf8")).toBe("Original contents");
    moving.mockRestore();
    await expectRejection(removeManagedProjectFolder(id, prepared)).toThrow("Files were retained");
    expect(await readFile(join(String(claimedPath), "user.txt"), "utf8")).toBe("Retain this replacement");
  } finally {
    moving.mockRestore();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("another process holds managed preparation and removal until its claim lease is released", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-folder-owner-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const id = "leased-project";
  const folder = await prepareManagedProjectFolder(id);
  await writeFile(join(folder, "owned.txt"), "Retain while another owner is active");
  const lease = join(root, "project-folder-ownership", `project-${id}.removal.sqlite`);
  const child = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "../../services/project-recovery/journal-owner.fixture.ts"),
      lease,
      "--lease-path",
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const ready = child.stdout.getReader();
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const output = await Promise.race([
      ready.read(),
      child.exited.then(() => {
        throw new Error("Folder owner exited before readiness");
      }),
      new Promise<never>((_, reject) => {
        watchdog = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("Folder owner did not become ready within 2000 ms"));
        }, 2000);
      }),
    ]);
    clearTimeout(watchdog);
    expect(new TextDecoder().decode(output.value).trim()).toBe("owned");
    await expectRejection(removeManagedProjectFolder(id, folder)).toThrow("Another Prompt Studio process");
    await expectRejection(prepareManagedProjectFolder(id)).toThrow("Another Prompt Studio process");
    expect(await readFile(join(folder, "owned.txt"), "utf8")).toBe("Retain while another owner is active");
    child.kill("SIGKILL");
    await child.exited;
    await removeManagedProjectFolder(id, folder);
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });
  } finally {
    clearTimeout(watchdog);
    child.kill("SIGKILL");
    await child.exited;
    ready.releaseLock();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("ownership survives a failed marker publication when rollback also fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-folder-create-receipt-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const id = "creation-retry";
  const folder = join(root, "projects", `project-${id}`);
  const record = join(root, "project-folder-ownership", `project-${id}`);
  const write = fs.writeFile;
  const move = fs.rename;
  const remove = fs.rmdir;
  const denied = () => Object.assign(new Error("Marker publication denied"), { code: "EROFS" });
  const writing = spyOn(fs, "writeFile").mockImplementation(async (path, ...args) => {
    if (path === record) throw denied();
    return write(path, ...args);
  });
  const moving = spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (to === record) throw denied();
    return move(from, to);
  });
  const removing = spyOn(fs, "rmdir").mockImplementation(async (path, ...args) => {
    if (path === folder) throw denied();
    return remove(path, ...args);
  });
  try {
    await expectRejection(prepareManagedProjectFolder(id)).toThrow("Marker publication denied");
    writing.mockRestore();
    moving.mockRestore();
    removing.mockRestore();
    const prepared = await prepareManagedProjectFolder(id);
    expect(await inspectManagedProjectFolder(id, prepared)).toEqual({ removesManagedFolder: true });
    await removeManagedProjectFolder(id, prepared);
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });
  } finally {
    writing.mockRestore();
    moving.mockRestore();
    removing.mockRestore();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});
