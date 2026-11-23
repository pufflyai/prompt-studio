import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { writeControllerFixture } from "./controller.test-fixture";
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
  ["a failed status check", "", true],
  ["an unhealthy controller", '{"state":"unhealthy"}', true],
  ["a controller that is not running", '{"state":"not_running"}', false],
])("Stop with %s", async (_, status, failed) => {
  const root = await mkdtemp(join(tmpdir(), "cloud-instance-stop-"));
  const instanceId = randomUUID();
  try {
    const binary = await writeControllerFixture(
      root,
      `if (process.argv.includes("status")) {
        const status = ${JSON.stringify(status)};
        if (status) console.log(status);
        process.exit(1);
      }`,
    );
    await mkdir(join(root, instanceId));
    // A managed record distinguishes a failed probe from a fresh or cleanly stopped instance.
    await mkdir(join(root, instanceId, "state"));
    await writeFile(join(root, instanceId, "state/server.json"), JSON.stringify({ pid: process.pid }));
    await writeFile(
      join(root, instanceId, "instance.json"),
      JSON.stringify({ id: instanceId, binary, url: "http://127.0.0.1:1" }),
    );
    const { stopInstance } = createInstanceCommands(() => createInstances(root));
    const ctx = makeCommandContext({ storage: createMemoryStorage(), projectId: "test", params: {} });
    const stopping = stopInstance.run(ctx, { instanceId });
    if (failed) await expect(stopping).rejects.toThrow();
    else expect(await stopping).toEqual({ instanceId, state: "stopped" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
