import { expect, test } from "bun:test";
import { workbenchCommands } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { registerProjectSetupCommand } from "./project-setup-command";

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
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      if (requests.length === 2) return Response.json({ id: "workspace-1", setupError: "Provider setup failed" });
      if (requests.length > 2) return Response.json({ error: "Setup unavailable" }, { status: 503 });
      return Response.json({ id: "workspace-1" });
    },
  });
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  try {
    const core = createWorkbench();
    core.pageLocations.setProject("project-2");
    selectDashboardProject(core, { id: "project-2", name: "Second" });
    registerProjectSetupCommand(core);
    await core.commands.executeCommand(workbenchCommands.retryProjectSetup.id, {}, { projectId: "project-2" });
    expect(requests).toEqual(["POST /v1/projects/project-2/retry-setup"]);
    await expect(core.commands.executeCommand(workbenchCommands.retryProjectSetup.id)).rejects.toThrow(
      "Provider setup failed",
    );
    await expect(core.commands.executeCommand(workbenchCommands.retryProjectSetup.id)).rejects.toThrow(
      "Setup unavailable",
    );
  } finally {
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
  const server = Bun.serve({ port: 0, fetch: () => Response.json(responses.shift()) });
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  try {
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
    if (previous) runtime.__PSTDIO_CONFIG__ = previous;
    else delete runtime.__PSTDIO_CONFIG__;
    server.stop(true);
  }
});
