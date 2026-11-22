import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInstances } from "./instances";

test("failed instance initialization leaves the instance list usable", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "cloud-instance-initialization-"));
  const write = fs.writeFile;
  const failure = new Error("No space for empty.env");
  const writing = spyOn(fs, "writeFile").mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).endsWith("/empty.env")) throw failure;
    return write(...args);
  });
  try {
    const instances = createInstances(root);
    await expect(instances.launch({ name: "Initialization fails", binary: process.execPath })).rejects.toBe(failure);
    expect(await instances.list()).toEqual([]);
    expect(await fs.readdir(root)).toEqual([]);
  } finally {
    writing.mockRestore();
    await fs.rm(root, { recursive: true, force: true });
  }
});
