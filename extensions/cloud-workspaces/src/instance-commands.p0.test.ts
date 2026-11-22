import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createInstanceCommands } from "./instance-commands";
import { createInstances } from "./instances";

test("Stop reports a failed status check instead of claiming the instance stopped", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-instance-stop-"));
  const instanceId = randomUUID();
  try {
    await mkdir(join(root, instanceId));
    await writeFile(
      join(root, instanceId, "instance.json"),
      JSON.stringify({ id: instanceId, binary: join(root, "moved-pocketcoder"), url: "http://127.0.0.1:1" }),
    );
    const { stopInstance } = createInstanceCommands(() => createInstances(root));
    const ctx = makeCommandContext({ storage: createMemoryStorage(), projectId: "test", params: {} });
    await expect(stopInstance.run(ctx, { instanceId })).rejects.toThrow("PocketCoder executable not found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  ["a hung or failed status check", "exit 1", "Controller status: unknown."],
  ["an unhealthy controller", `echo '{"state":"unhealthy"}'; exit 1`, "Controller status: unhealthy."],
  ["a controller that is not running", `echo '{"state":"not_running"}'; exit 1`, undefined],
])("Stop with %s", async (_, status, error) => {
  const root = await mkdtemp(join(tmpdir(), "cloud-instance-stop-"));
  const instanceId = randomUUID();
  const binary = join(root, "pocketcoder");
  try {
    await writeFile(binary, `#!/bin/sh\nshift 2\ncase "$1 $2" in\n  "server status") ${status} ;;\nesac\n`, {
      mode: 0o755,
    });
    await mkdir(join(root, instanceId));
    await writeFile(
      join(root, instanceId, "instance.json"),
      JSON.stringify({ id: instanceId, binary, url: "http://127.0.0.1:1" }),
    );
    const { stopInstance } = createInstanceCommands(() => createInstances(root));
    const ctx = makeCommandContext({ storage: createMemoryStorage(), projectId: "test", params: {} });
    const stopping = stopInstance.run(ctx, { instanceId });
    if (error) await expect(stopping).rejects.toThrow(error);
    else expect(await stopping).toEqual({ instanceId, state: "stopped" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
