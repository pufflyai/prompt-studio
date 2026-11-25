import { expect, test } from "bun:test";
import type { ExtensionConnectionsApi } from "pstdio-api-contracts/extension-kernel";
import { createProcessOwner, type RuntimeHarnessRecord } from "pstdio-extensions";
import type { ExtensionTargets } from "../extensions/extension-targets";
import { createHarnessContextFactory } from "./harness-context";

const record = { extensionId: "test.agent", name: "agent" } as RuntimeHarnessRecord;

const setup = () => {
  const calls: unknown[] = [];
  const targets: ExtensionTargets = {
    process: async (input) => {
      calls.push(["process", input]);
      return {
        kind: "remote",
        spawn: async () => {
          throw new Error("not started in this test");
        },
      };
    },
    readText: async (input) => {
      calls.push(["readText", input]);
      return "history";
    },
  };
  const factory = createHarnessContextFactory({ connections: () => ({}) as ExtensionConnectionsApi, targets });
  return { calls, factory };
};

test("session processes and history reads route through the calling project's workspace", async () => {
  const { calls, factory } = setup();
  const ctx = await factory(record, { projectId: "p1" }, createProcessOwner());
  expect(await ctx.targetFiles.readText({ workspaceId: "w1", path: "~/.claude/projects/s.jsonl" })).toBe("history");
  await ctx.process.spawn({ command: ["claude"], workspaceId: "w1" }).exited;
  expect(calls).toEqual([
    ["readText", { projectId: "p1", workspaceId: "w1", path: "~/.claude/projects/s.jsonl" }],
    ["process", { projectId: "p1", workspaceId: "w1" }],
  ]);
});

test("a host-level harness call cannot target a workspace", async () => {
  const { calls, factory } = setup();
  const ctx = await factory(record, undefined, createProcessOwner());
  await expect(ctx.targetFiles.readText({ workspaceId: "w1", path: "x" })).rejects.toMatchObject({
    code: "target_file_unavailable",
  });
  await expect(ctx.process.spawn({ command: ["claude"], workspaceId: "w1" }).started).rejects.toMatchObject({
    code: "process_target_unavailable",
  });
  expect(calls).toEqual([]);
});

test("a harness's run commands stop when its instance closes, so retirement never waits on one", async () => {
  const { factory } = setup();
  const owner = createProcessOwner();
  const ctx = await factory(record, { projectId: "p1" }, owner);
  // A sign-in waiting on a command that never exits by itself, such as an interactive login.
  const login = ctx.process.run({ command: [process.execPath, "-e", "setInterval(() => {}, 1000)"] });
  const finished = login.then(
    () => "finished",
    () => "stopped",
  );
  await Bun.sleep(200);
  await owner.close();
  expect(await Promise.race([finished, Bun.sleep(5_000).then(() => "still running")])).toBe("stopped");
});
