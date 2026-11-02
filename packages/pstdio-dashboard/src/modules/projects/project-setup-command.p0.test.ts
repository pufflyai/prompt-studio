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
  selectDashboardProject(core, { id: "project-2", name: "Second" });
  await expect(
    core.commands.executeCommand(workbenchCommands.retryProjectSetup.id, undefined, { projectId: "project-1" }),
  ).rejects.toThrow("another project");
});

test("setup retry uses the selected project's public API and propagates action errors", async () => {
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      if (requests.length > 1) return Response.json({ error: "Setup unavailable" }, { status: 503 });
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
      "Setup unavailable",
    );
  } finally {
    if (previous) runtime.__PSTDIO_CONFIG__ = previous;
    else delete runtime.__PSTDIO_CONFIG__;
    server.stop(true);
  }
});
