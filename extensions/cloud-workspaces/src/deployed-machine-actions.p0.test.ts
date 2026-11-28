import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { ExtensionConnectionsApi, NavigationTarget } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { openDeployedMachine } from "./deployed-machine";
import { listDeployedMachines } from "./deployed-machines-commands";
import type { ControllerMachine } from "./machines";

function fixture(state: ControllerMachine["state"], preview: boolean) {
  const machine: ControllerMachine = {
    id: randomUUID(),
    external_id: "deployed-example",
    state,
    agent_state: "connected",
    change_cursor: 1,
    reason_code: null,
    failure: null,
    created_at: "2026-11-22T00:00:00Z",
    template: { name: preview ? "prompt-studio-preview" : "tests", version: "1", digest: "fixture" },
    metadata: { purpose: preview ? "pstdio-preview" : "remote-testing" },
    persistence: {
      enabled: false,
      conversation_resume: { status: "unknown", reason: null },
      latest_checkpoint_id: null,
    },
  };
  const opened: NavigationTarget[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "project",
    params: {},
    overrides: {
      extensionId: "pocketcoder.pocketcoder",
      navigation: { open: (target) => opened.push(target) },
      connections: {
        request: async <TBody>(
          _connection: Parameters<ExtensionConnectionsApi["request"]>[0],
          request: Parameters<ExtensionConnectionsApi["request"]>[1],
        ) => ({
          status: 200,
          headers: {},
          body: (request.path.includes("?") ? { items: [machine], next_cursor: null } : machine) as TBody,
        }),
      },
    },
  });
  const row = async () => {
    const result = await listDeployedMachines.run(ctx, {});
    return result.rows[0]?.resource;
  };
  const open = async () => {
    await openDeployedMachine.run(ctx, { machineId: machine.id });
    const target = opened.at(-1);
    if (target?.kind !== "page" || !target.resource) throw new Error("Expected deployed machine navigation");
    expect(target.resource).toMatchObject({
      id: machine.id,
      label: machine.external_id,
      extensionId: ctx.extensionId,
      projectId: ctx.projectId,
    });
    expect(target.parent).toMatchObject({
      page: { id: "deployed", extensionId: ctx.extensionId },
      resource: { type: "deployed-instance", label: "Deployed PocketCoder" },
    });
    return target.resource;
  };
  return { machine, row, open };
}

test.each([
  { state: "queued", preview: false, stop: true, openPreview: false },
  { state: "ready", preview: false, stop: true, openPreview: false },
  { state: "ready", preview: true, stop: true, openPreview: true },
  { state: "terminating", preview: true, stop: false, openPreview: false },
  { state: "canceled", preview: true, stop: false, openPreview: false },
] as const)("opening a deployed machine retains its row actions (%j)", async (input) => {
  const f = fixture(input.state, input.preview);
  for (const resource of [await f.row(), await f.open()]) {
    expect(resource?.metadata?.canStop === true).toBe(input.stop);
    expect(resource?.metadata?.canOpenPreview === true).toBe(input.openPreview);
  }
});

test("opening a machine uses its current state instead of stale table availability", async () => {
  const f = fixture("ready", true);
  expect((await f.row())?.metadata).toMatchObject({ canStop: true, canOpenPreview: true });
  f.machine.state = "terminating";
  const resource = await f.open();
  expect(resource.metadata?.canStop === true).toBe(false);
  expect(resource.metadata?.canOpenPreview === true).toBe(false);
});
