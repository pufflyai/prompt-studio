import { expect, test } from "bun:test";
import { workbenchCommands } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { registerProjectSetupCommand } from "./project-setup-command";

const attachWorkspace = () => {
  getCollection("workspaces");
  getWriter("workspaces")?.truncateAndWrite([
    { id: "workspace-1", project_id: "project-2", is_default: true, root_path: "/project" },
  ]);
};

test("setup retry requires its selected project and rejects a stale webview project", async () => {
  const core = createWorkbench();
  registerProjectSetupCommand(core);
  await expect(core.commands.executeCommand(workbenchCommands.retryProjectSetup.id)).rejects.toThrow(
    "selected project",
  );
  core.pageLocations.setProject("project-1");
  selectDashboardProject(core, { id: "project-2", name: "Second" });
  await expect(
    core.commands.executeCommand(workbenchCommands.retryProjectSetup.id, undefined, { projectId: "project-1" }),
  ).rejects.toThrow("The selected project changed");
});

test("setup retry uses the selected project's public API and propagates action errors", async () => {
  const requests: string[] = [];
  let retries = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      if (request.method === "GET") return Response.json({ state: "synced", offlineReady: true });
      if (++retries === 2) return Response.json({ id: "workspace-1", setupError: "Provider setup failed" });
      if (retries > 2) return Response.json({ error: "Setup unavailable" }, { status: 503 });
      return Response.json({ id: "workspace-1" });
    },
  });
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  try {
    attachWorkspace();
    const core = createWorkbench();
    core.pageLocations.setProject("project-2");
    selectDashboardProject(core, { id: "project-2", name: "Second" });
    registerProjectSetupCommand(core);
    await core.commands.executeCommand(workbenchCommands.retryProjectSetup.id, {}, { projectId: "project-2" });
    expect(requests).toEqual(["GET /v1/account/projects/project-2/sync", "POST /v1/projects/project-2/retry-setup"]);
    await expect(core.commands.executeCommand(workbenchCommands.retryProjectSetup.id)).rejects.toThrow(
      "Provider setup failed",
    );
    await expect(core.commands.executeCommand(workbenchCommands.retryProjectSetup.id)).rejects.toThrow(
      "Setup unavailable",
    );
  } finally {
    getWriter("workspaces")?.truncateAndWrite([]);
    if (previous) runtime.__PSTDIO_CONFIG__ = previous;
    else delete runtime.__PSTDIO_CONFIG__;
    server.stop(true);
  }
});

test("setup retry reports unavailable providers even when remote setupError was cleared", async () => {
  const responses = [
    {
      providerState: "provider_missing",
      setupError: null,
      provider_error_json: { message: "Remote provider is unavailable" },
    },
    { providerState: "failed", setupError: null, provider_error_json: null },
    { providerState: "provisioning", setupError: null, provider_error_json: null },
  ];
  const server = Bun.serve({
    port: 0,
    fetch: (request) =>
      Response.json(request.method === "GET" ? { state: "local", offlineReady: true } : responses.shift()),
  });
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  try {
    attachWorkspace();
    const core = createWorkbench();
    selectDashboardProject(core, { id: "project-2", name: "Second" });
    registerProjectSetupCommand(core);
    await expect(core.commands.executeCommand(workbenchCommands.retryProjectSetup.id)).rejects.toThrow(
      "Remote provider is unavailable",
    );
    await expect(core.commands.executeCommand(workbenchCommands.retryProjectSetup.id)).rejects.toThrow(
      "Workspace provider setup failed",
    );
    await core.commands.executeCommand(workbenchCommands.retryProjectSetup.id);
  } finally {
    getWriter("workspaces")?.truncateAndWrite([]);
    if (previous) runtime.__PSTDIO_CONFIG__ = previous;
    else delete runtime.__PSTDIO_CONFIG__;
    server.stop(true);
  }
});

test.each([
  { sync: { state: "synced", offlineReady: true }, endpoint: "/v1/projects/project-2/open" },
  { sync: { state: "needs-attention", offlineReady: false }, endpoint: "/v1/account/projects/project-2/retry" },
])("project preparation retries the missing prerequisite at $endpoint", async ({ sync, endpoint }) => {
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return Response.json(request.method === "GET" ? sync : { id: "workspace-1", ok: true });
    },
  });
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  try {
    const core = createWorkbench();
    selectDashboardProject(core, { id: "project-2", name: "Second" });
    registerProjectSetupCommand(core);
    await core.commands.executeCommand(workbenchCommands.retryProjectSetup.id);
    expect(requests).toEqual(["GET /v1/account/projects/project-2/sync", `POST ${endpoint}`]);
  } finally {
    if (previous) runtime.__PSTDIO_CONFIG__ = previous;
    else delete runtime.__PSTDIO_CONFIG__;
    server.stop(true);
  }
});

test("setup retry keeps a provisioning local workspace request pending", async () => {
  const requests: string[] = [];
  let release = () => {};
  let started = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      if (request.method === "GET") return Response.json({ state: "synced", offlineReady: true });
      started();
      await held;
      return Response.json({ id: "workspace-1", root_path: "/prepared", providerState: "ready" });
    },
  });
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  let retry: Promise<unknown> | undefined;
  let settled = false;
  try {
    getCollection("workspaces");
    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-1",
        project_id: "project-2",
        is_default: true,
        root_path: null,
        provider_operation_id: "create-pending",
        provider_state: "provisioning",
      },
    ]);
    const core = createWorkbench();
    selectDashboardProject(core, { id: "project-2", name: "Second" });
    registerProjectSetupCommand(core);
    retry = core.commands.executeCommand(workbenchCommands.retryProjectSetup.id).finally(() => {
      settled = true;
    });
    await requested;
    expect(requests).toEqual(["GET /v1/account/projects/project-2/sync", "POST /v1/projects/project-2/retry-setup"]);
    expect(settled).toBe(false);
    release();
    await retry;
    expect(settled).toBe(true);
  } finally {
    release();
    await Promise.allSettled(retry ? [retry] : []);
    getWriter("workspaces")?.truncateAndWrite([]);
    if (previous) runtime.__PSTDIO_CONFIG__ = previous;
    else delete runtime.__PSTDIO_CONFIG__;
    server.stop(true);
  }
});
