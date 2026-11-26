import { expect, test } from "bun:test";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import type { ControllerMachine } from "./machines";
import { monitoringCommands } from "./workspace-monitoring-commands";

const end = Date.parse("2026-11-26T12:00:00Z");
const hour = 3_600_000;
const machine = {
  id: "sample",
  external_id: "preview & test",
  state: "succeeded",
  template: { name: "preview", version: "1", digest: "digest" },
  created_at: new Date(end - 2 * hour).toISOString(),
  ready_at: new Date(end - hour).toISOString(),
  terminal_at: new Date(end - hour / 2).toISOString(),
} satisfies Partial<ControllerMachine>;

function fixture(respond: (path: string) => unknown) {
  const paths: string[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "project",
    params: {},
    overrides: {
      extensionId: "pocketcoder.pocketcoder",
      settings: {
        all: async () => ({ monitoringDefaultHourlyUsd: "0.5" }),
        get: async () => undefined,
        set: async () => {},
        delete: async () => {},
      },
      connections: {
        request: async <T>(
          _connection: Parameters<ExtensionConnectionsApi["request"]>[0],
          input: Parameters<ExtensionConnectionsApi["request"]>[1],
        ) => {
          paths.push(input.path);
          return { status: 200, headers: {}, body: respond(input.path) as T };
        },
      },
    },
  });
  return { paths, ctx };
}

test("monitoring requests one filtered cursor page and returns a routable workspace with the same estimate as detail", async () => {
  const { paths, ctx } = fixture((path) =>
    path.startsWith("/v1/workspaces?") ? { items: [machine], next_cursor: "more" } : machine,
  );
  const list = await monitoringCommands["deployed.monitoring-workspaces"].run(ctx, {
    name: machine.external_id,
    state: "succeeded",
    cursor: "cursor",
    range: "hour",
    asOf: end,
  });
  const detail = await monitoringCommands["deployed.monitoring-workspace"].run(ctx, {
    machineId: machine.id,
    range: "hour",
    asOf: end,
  });

  expect(paths).toEqual([
    "/v1/workspaces?limit=25&external_id=preview+%26+test&state=succeeded&cursor=cursor",
    "/v1/workspaces/sample",
  ]);
  expect(list.nextCursor).toBe("more");
  expect(list.rows[0]).toMatchObject({ runtimeMs: hour / 2, costUsd: 0.25, resource: { id: machine.id } });
  expect(detail).toMatchObject(list.rows[0]);
});

test("monitoring summary can price the legacy activity response without template groups", async () => {
  const { paths, ctx } = fixture(() => ({
    running: 1,
    peak: 1,
    points: [
      { count: 1, time: end - hour },
      { count: 1, time: end },
    ],
  }));
  const value = await monitoringCommands["deployed.monitoring-summary"].run(ctx, { range: "hour" });
  expect(paths).toEqual(["/v1/workspaces/activity?range=hour"]);
  expect(value.usage).toMatchObject({ runtimeMs: hour, costUsd: 0.5, unpricedRuntimeMs: 0 });
});
