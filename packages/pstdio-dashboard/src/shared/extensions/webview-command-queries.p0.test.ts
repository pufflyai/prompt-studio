import { expect, test } from "bun:test";
import type { AccountStatus } from "@pstdio/sdk/client";
import { workbenchCommands } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore } from "@pstdio/workbench";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import {
  dashboardQueryAuthority,
  getDashboardAccountStatusQuery,
  getDashboardScopedQueries,
} from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { publishExtensionEvent, subscribeToExtensionEventFeed } from "./extension-webview-broadcast";
import { createDashboardWebviewCommandQueries } from "./webview-command-queries";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const status = (accountId: string): AccountStatus => ({
  login: {
    accountId,
    managerOrigin: "https://account.example",
    relayOrigin: "https://relay.example",
    deviceId: "device",
  },
  features: { relay: true },
  cloudProjects: ["project"],
  cloudProjectsLoaded: true,
});
const fixture = async () => {
  let account = status("first");
  let held: Promise<Response> | undefined;
  const entered = Promise.withResolvers<void>();
  const calls: { path: string; body: unknown }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      if (!path.includes("/commands/")) return Response.json(account);
      calls.push({ path, body: await request.json() });
      entered.resolve();
      if (held) return held;
      return Response.json({
        commandId: "example.tool.command.read",
        extensionId: "example.tool",
        eventIds: [],
        outcome: { ok: true, status: "success", value: { title: account.login?.accountId } },
      });
    },
  });
  const runtime = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  await getDashboardAccountStatusQuery(runtime).read();
  const cores: WorkbenchCore[] = [];
  const publishers: ReturnType<typeof createHostEventPublisher>[] = [];
  const core = () => {
    const value = createWorkbench({ queries: getDashboardScopedQueries(runtime) });
    value.pageLocations.setProject("project");
    cores.push(value);
    return value;
  };
  const frame = (workbench = core()) => {
    const events = createHostEventPublisher();
    events.bind(() => {});
    publishers.push(events);
    const adapter = createDashboardWebviewCommandQueries({
      runtime,
      workbench,
      events,
      queryScope: {
        runtimeId: String(runtime.id),
        ...dashboardQueryAuthority(getDashboardAccountStatusQuery(runtime).getSnapshot().data),
      },
      projectId: "project",
      extensionId: "example.tool",
      extensionInstanceId: "instance",
      webviewId: "home",
      source: ["/runtime.js", "/home.js"],
      resource: { extensionId: "example.tool", type: "note", id: "document" },
    });
    const request = (operation: "read" | "refresh" = "read", commandId = "example.tool.command.read") =>
      adapter.request({
        owner: adapter.seeds().owner,
        requestId: crypto.randomUUID(),
        operation,
        command: { commandId, params: { filter: "open" }, workspaceId: "workspace" },
        dependsOn: ["example.tool.event.changed"],
      });
    return { adapter, request, workbench, close: () => events.unbind() };
  };
  return {
    runtime,
    calls,
    core,
    frame,
    entered: entered.promise,
    hold: (response: Promise<Response>) => {
      held = response;
    },
    changeAccount: async () => {
      account = status("second");
      publishExtensionEvent({ id: "account.changed" }, runtime);
      await getDashboardAccountStatusQuery(runtime).read();
    },
    async dispose() {
      for (const publisher of publishers) publisher.unbind();
      for (const workbench of cores) await workbench.dispose();
      await runtime.dispose();
      await server.stop(true);
    },
  };
};

test("recreated dashboard frames share the actual command read without catalog invalidation or a retired core", async () => {
  const f = await fixture();
  const events: string[] = [];
  const stop = subscribeToExtensionEventFeed((event) => events.push(event.id), f.runtime);
  const first = f.frame();
  try {
    expect((await first.request())?.data).toEqual({ title: "first" });
    first.close();
    await first.workbench.dispose();
    const returned = f.frame();
    expect(returned.adapter.seeds().values[0]?.snapshot.data).toEqual({ title: "first" });
    expect((await returned.request())?.data).toEqual({ title: "first" });
    expect(f.calls).toHaveLength(1);
    publishExtensionEvent({ id: "example.tool.event.changed", projectId: "other" }, f.runtime);
    publishExtensionEvent({ id: "example.tool.event.changed", projectId: "project" }, f.runtime);
    await turn();
    expect(f.calls).toHaveLength(1);
    expect((await returned.request())?.data).toEqual({ title: "first" });
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]).toMatchObject({
      path: "/v1/projects/project/extensions/commands/example.tool.command.read/execute",
      body: {
        params: { filter: "open" },
        workspaceId: "workspace",
        source: "dashboard",
        resource: { extensionId: "example.tool", type: "note", id: "document" },
        slot: { id: "home", kind: "panel" },
      },
    });
    expect(events).toEqual(["example.tool.event.changed", "example.tool.event.changed"]);
  } finally {
    stop();
    await f.dispose();
  }
});

test("dashboard built-in queries use each actual core's command and retire its private history", async () => {
  const f = await fixture();
  const a = f.core();
  const b = f.core();
  for (const [core, title] of [
    [a, "A recents"],
    [b, "B recents"],
  ] as const)
    core.commands.registerCommand(
      { id: workbenchCommands.recentResources.id, label: "Recent" },
      { execute: () => title },
    );
  const first = f.frame(a);
  const second = f.frame(b);
  try {
    expect((await first.request("read", workbenchCommands.recentResources.id))?.data).toBe("A recents");
    expect(second.adapter.seeds().values).toHaveLength(0);
    expect((await second.request("read", workbenchCommands.recentResources.id))?.data).toBe("B recents");
    await a.dispose();
    await expect(first.request("refresh", workbenchCommands.recentResources.id)).rejects.toThrow("closed");
    expect((await second.request("refresh", workbenchCommands.recentResources.id))?.data).toBe("B recents");
    expect(f.calls).toHaveLength(0);
  } finally {
    await f.dispose();
  }
});

test("account changes retire an in-flight dashboard read and reject its captured authority", async () => {
  const f = await fixture();
  const held = Promise.withResolvers<Response>();
  f.hold(held.promise);
  const frame = f.frame();
  const pending = frame.request();
  void pending.catch(() => {});
  const events: string[] = [];
  const stop = subscribeToExtensionEventFeed((event) => events.push(event.id), f.runtime);
  try {
    await f.entered;
    await f.changeAccount();
    const retired = await pending;
    expect(retired).toMatchObject({ retired: true });
    expect(retired?.data).toBeUndefined();
    await expect(frame.request()).rejects.toThrow("closed");
    held.resolve(
      Response.json({
        commandId: "example.tool.command.read",
        extensionId: "example.tool",
        eventIds: ["obsolete.event"],
        outcome: { ok: true, status: "success", value: { title: "private first" } },
      }),
    );
    await turn();
    expect(frame.adapter.seeds().values).toHaveLength(0);
    expect(f.calls).toHaveLength(1);
    expect(events).toEqual(["account.changed"]);
  } finally {
    stop();
    held.resolve(Response.json({}));
    await f.dispose();
  }
});
