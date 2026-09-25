import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchLayout } from "@pstdio/workbench";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "@pstdio/workbench/react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { resolveDashboardPersistenceScope } from "@/shared/workbench/dashboard-persistence-scope";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata } from "./module-test-fixtures";

test("keeps a Start terminal alive while an open Lab page receives fresh webview metadata", async () => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const workbench = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => layouts.get(scope),
      setLayout: (layout, scope) => {
        layouts.set(scope, structuredClone(layout));
      },
    },
    resolvePagePersistenceScope: resolveDashboardPersistenceScope,
  });
  workbench.modes.registerMode({ id: "project", panels: ["main", "secondary", "side"], activate() {} });
  workbench.modes.registerMode({ id: "sessions", panels: ["main", "side"], activate() {} });
  for (const id of ["start", "sessions"]) {
    workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
    workbench.pages.registerPage({
      id,
      ref: { extensionId: "pstdio", kind: "page", id },
      path: id === "start" ? "" : id,
      modeId: id === "start" ? "project" : "sessions",
      main: { kind: "view", view: { kind: "view", id }, cardinality: "one" },
      slots: [],
    });
  }
  workbench.registerModule(createWorkbenchTerminalModule());
  let currentMetadata: WorkbenchExtensionMetadata = metadata;
  selectDashboardProject(workbench, { id: "terminal-refresh", name: "Terminal refresh" });
  const extension = workbench.registerModule(
    createExtensionsModule({
      loadAppearance: async () => emptyAppearance,
      loadMetadata: async () => currentMetadata,
    }),
  );
  const child = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  const kills: string[] = [];
  const writer = getWriter("extension_instances");
  try {
    await flushMicrotasks();
    await flushMicrotasks();
    workbench.pageLocations.setProject("terminal-refresh");
    expect(workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.start }).ok).toBe(true);
    workbench.terminal.setSessionOpener(async () => ({
      id: "terminal-child",
      write() {},
      resize() {},
      kill() {
        kills.push("terminal-child");
        child.kill("SIGTERM");
        return child.exited.then(() => undefined);
      },
      onData: () => () => {},
      onExit: () => () => {},
      onError: () => () => {},
    }));
    const placement = openWorkbenchTerminal(workbench);
    const bindingId = JSON.stringify([workbench.layout.getPersistenceScope(), placement.instanceId]);
    await workbench.terminal.open({ bindingId, request: { cols: 80, rows: 24 } });
    expect(
      workbench.pageLocations.navigate({ kind: "page", page: { extensionId: "pstdio", kind: "page", id: "sessions" } })
        .ok,
    ).toBe(true);
    expect(
      workbench.pageLocations.navigate({
        kind: "page",
        page: { extensionId: "pstdio.extension-lab", kind: "page", id: "labPage" },
      }).ok,
    ).toBe(true);
    expect(kills).toEqual([]);
    currentMetadata = {
      ...metadata,
      views: metadata.views.map((view) => ({
        ...view,
        body: {
          ...view.body,
          webview: { ...view.body.webview, moduleUrl: `${view.body.webview.moduleUrl}?revision=2` },
        },
      })),
    };
    writer?.upsert({ id: "updated-terminal-webview" });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(workbench.pages.store.getState().activePageId).toBe(metadata.pages[0]!.id);
    expect(kills).toEqual([]);
    expect(child.exitCode).toBeNull();
    expect(workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.start }).ok).toBe(true);
    const restored = workbench.layout
      .listPanelInstances("secondary")
      .find((panel) => panel.instanceId === placement.instanceId);
    expect(restored).toBeDefined();
    const identity = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((panel) => panel.widgetId === placement.instanceId)?.placementIdentity;
    if (!identity) throw new Error("The restored terminal must have a placement owner");
    workbench.shellPlacements.closePlacement(identity);
    await child.exited;
    expect(kills).toEqual(["terminal-child"]);
  } finally {
    extension.dispose();
    writer?.remove("updated-terminal-webview");
    child.kill("SIGKILL");
    await child.exited;
  }
});
