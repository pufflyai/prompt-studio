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

test("a failed launch keeps the instance state when the rollback cannot confirm the controller stopped", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "cloud-instance-rollback-"));
  const binary = join(root, "controller.ts");
  const instancesRoot = join(root, "instances");
  let directory = "";
  let publications = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.method !== "POST" || new URL(request.url).pathname !== "/v1/templates")
        throw new Error("Unexpected controller request");
      publications++;
      await fs.writeFile(join(directory, "publication-failed"), "yes");
      return Response.json({ error: { code: "publish_failed", message: "Template rejected" } }, { status: 503 });
    },
  });
  await fs.writeFile(
    binary,
    `#!${process.execPath}
import { mkdir, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
if (args.includes("status")) {
  if (await Bun.file("publication-failed").exists()) { console.error("Probe unavailable after publication"); process.exit(1); }
  const running = await Bun.file("state/server.json").exists();
  console.log(JSON.stringify({ state: running ? "running" : "not_running" })); process.exit(running ? 0 : 1);
}
if (args.includes("start")) { await mkdir("state", { recursive: true }); await writeFile("state/server.json", JSON.stringify({ pid: ${process.pid} })); }
if (args.includes("stop")) await writeFile("stop-attempted", "yes");
if (args.includes("superuser")) console.log(JSON.stringify({ token: "fixture", key: { expires_at: "2099-01-01T00:00:00Z" } }));
`,
    { mode: 0o700 },
  );
  let ports = 0;
  try {
    const instances = createInstances(instancesRoot);
    const result = await instances
      .launch({ name: "Publish fails", binary, manifests: [{}] }, async () => {
        directory = join(instancesRoot, (await fs.readdir(instancesRoot))[0]!);
        return ports++ === 0 ? server.port! : server.port! + 1;
      })
      .catch((error: unknown) => error);
    expect(publications).toBe(1);
    expect(result).toBeInstanceOf(AggregateError);
    expect((result as AggregateError).errors[0]).toHaveProperty("status", 503);
    expect(await fs.readdir(instancesRoot)).toHaveLength(1);
    expect(await Bun.file(join(directory, "stop-attempted")).exists()).toBe(true);
  } finally {
    try {
      await server.stop(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});
