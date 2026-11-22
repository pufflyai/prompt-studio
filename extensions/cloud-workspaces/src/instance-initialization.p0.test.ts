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
    await expect(
      instances.launch({ name: "Initialization fails", binary: process.execPath }, async () => 0),
    ).rejects.toBe(failure);
    expect(await instances.list()).toEqual([]);
    expect(await fs.readdir(root)).toEqual([]);
  } finally {
    writing.mockRestore();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("instance initialization uses the supplied port allocator and keeps controller ports distinct", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "cloud-instance-ports-"));
  const write = fs.writeFile;
  const stopBeforeStart = new Error("Fixture stops before controller startup");
  let saved: { url: string; agentPort: number } | undefined;
  const writing = spyOn(fs, "writeFile").mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).includes("instance.json.")) {
      saved = JSON.parse(String(args[1]));
      throw stopBeforeStart;
    }
    return write(...args);
  });
  const ports = [4100, 4100, 4101];
  let allocations = 0;
  try {
    const instances = createInstances(root);
    await expect(
      instances.launch({ name: "Allocated ports", binary: process.execPath }, async () => ports[allocations++]!),
    ).rejects.toBe(stopBeforeStart);
    expect(allocations).toBe(3);
    expect(saved).toMatchObject({ url: "http://127.0.0.1:4100", agentPort: 4101 });
    expect(await fs.readdir(root)).toEqual([]);
  } finally {
    writing.mockRestore();
    await fs.rm(root, { recursive: true, force: true });
  }
});
