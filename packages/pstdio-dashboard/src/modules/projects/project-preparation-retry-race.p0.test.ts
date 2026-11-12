import { expect, test } from "bun:test";
import { workbenchCommands } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { publishExtensionEventReset } from "@/shared/extensions/extension-webview-broadcast";
import { registerProjectOpening } from "./project-opening";
import { registerProjectSetupCommand } from "./project-setup-command";
import { createProjectSetupRequests } from "./project-setup-requests";

test.each(["automatic", "retry"])("%s project preparation shares ownership with the other caller", async (first) => {
  const held = Promise.withResolvers<void>();
  const requestStarted = Promise.withResolvers<void>();
  const retryJoined = Promise.withResolvers<void>();
  const automaticJoined = Promise.withResolvers<void>();
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push(`${request.method} ${path}`);
      if (request.method === "GET") return Response.json({ state: "synced", offlineReady: true });
      requestStarted.resolve();
      await held.promise;
      return Response.json({ id: "workspace-race", root_path: "/prepared", providerState: "ready" });
    },
  });
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const core = createWorkbench();
  const setup = createProjectSetupRequests();
  let opening: ReturnType<typeof registerProjectOpening> | undefined;
  let retry: Promise<unknown> | undefined;
  let automatic: Promise<unknown> | undefined;
  let retrySettled = false;
  try {
    getCollection("workspaces");
    getWriter("workspaces")?.truncateAndWrite([
      { id: "ready-before-retry", project_id: "project-race", is_default: true, root_path: "/old" },
    ]);
    selectDashboardProject(core, { id: "project-race", name: "Project race" });
    registerProjectSetupCommand(core, {
      run(id, prepare) {
        const work = setup.run(id, prepare);
        retryJoined.resolve();
        return work;
      },
    });
    opening = registerProjectOpening(core, {
      run(id, prepare) {
        const work = setup.run(id, prepare);
        automatic = work;
        automaticJoined.resolve();
        return work;
      },
    });
    getWriter("workspaces")?.truncateAndWrite([]);
    if (first === "automatic") {
      publishExtensionEventReset({});
      await requestStarted.promise;
    }
    retry = core.commands.executeCommand(workbenchCommands.retryProjectSetup.id).finally(() => {
      retrySettled = true;
    });
    if (first === "retry") {
      await requestStarted.promise;
      publishExtensionEventReset({});
    }
    await Promise.all([retryJoined.promise, automaticJoined.promise]);
    expect(retrySettled).toBe(false);
    expect(requests.filter((request) => request.startsWith("POST "))).toEqual(["POST /v1/projects/project-race/open"]);
    held.resolve();
    await Promise.all([retry, automatic]);
    expect(requests.filter((request) => request.startsWith("POST "))).toEqual(["POST /v1/projects/project-race/open"]);
  } finally {
    held.resolve();
    await Promise.allSettled([retry, automatic].filter(Boolean));
    opening?.dispose();
    getWriter("workspaces")?.truncateAndWrite([]);
    if (previous) runtime.__PSTDIO_CONFIG__ = previous;
    else delete runtime.__PSTDIO_CONFIG__;
    server.stop(true);
  }
});
