import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeviceFileSaver } from "./save-device-file";

test("Save as writes the exact bytes only to the selected destination", async () => {
  const root = await mkdtemp(join(tmpdir(), "device-export-"));
  const path = join(root, "chosen.svg");
  const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><text>Våg</text></svg>');
  const saver = createDeviceFileSaver(async (options) => {
    expect(options.defaultPath).toBe("great-wave.svg");
    return { canceled: false, filePath: path };
  });
  try {
    expect(await saver({ name: "great-wave.svg", data: bytes, mimeType: "image/svg+xml" })).toEqual({
      status: "saved",
    });
    expect(new Uint8Array(await readFile(path))).toEqual(bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cancelling Save as never writes a file or reports success", async () => {
  const root = await mkdtemp(join(tmpdir(), "device-cancel-"));
  const path = join(root, "cancelled.svg");
  try {
    const saver = createDeviceFileSaver(async () => ({ canceled: true, filePath: path }));
    expect(await saver({ name: "page.svg", data: new ArrayBuffer(0) })).toEqual({ status: "cancelled" });
    await expect(stat(path)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed writes reject and a new Save as can recover", async () => {
  const root = await mkdtemp(join(tmpdir(), "device-retry-"));
  let path = join(root, "missing", "page.svg");
  const saver = createDeviceFileSaver(async () => ({ canceled: false, filePath: path }));
  try {
    await expect(saver({ name: "page.svg", data: new Uint8Array([1]) })).rejects.toThrow();
    path = join(root, "page.svg");
    expect(await saver({ name: "page.svg", data: new Uint8Array([2]) })).toEqual({ status: "saved" });
    expect(new Uint8Array(await readFile(path))).toEqual(new Uint8Array([2]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid guest filenames, paths and non-binary sources never open a native dialog", async () => {
  let dialogs = 0;
  const saver = createDeviceFileSaver(async () => {
    dialogs++;
    return { canceled: true, filePath: "" };
  });
  for (const input of [
    { name: "../page.svg", data: new Uint8Array() },
    { name: "folder\\page.svg", data: new Uint8Array() },
    { name: ".", data: new Uint8Array() },
    { name: "page.svg", data: "https://example.com/page.svg" },
    { name: "page.svg", data: new Uint8Array(), path: "/tmp/guest-selected.svg" },
  ])
    await expect(saver(input)).rejects.toThrow();
  expect(dialogs).toBe(0);
});

test("a partial write preserves the previous destination, removes staging, and hides device paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "device-preserve-"));
  const path = join(root, "private-name.svg");
  await writeFile(path, "previous export");
  const saver = createDeviceFileSaver(
    async () => ({ canceled: false, filePath: path }),
    async (staged) => {
      await writeFile(staged, "partial");
      throw new Error(`ENOSPC at ${path}`);
    },
  );
  try {
    let failure = "";
    try {
      await saver({ name: "new.svg", data: new Uint8Array([1]) });
    } catch (error) {
      failure = String(error);
    }
    expect(failure).toContain("Could not save");
    expect(failure).not.toContain(root);
    expect(await readFile(path, "utf8")).toBe("previous export");
    expect(await readdir(root)).toEqual(["private-name.svg"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
