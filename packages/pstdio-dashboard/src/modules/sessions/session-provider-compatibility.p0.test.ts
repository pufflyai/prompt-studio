import { expect, test } from "bun:test";
import { contributionRefId, sessionBrowser, workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createSessionsModule } from "./module";

test("core keeps identity but no Sessions presentation when the provider is unavailable", () => {
  const wb = createWorkbench();
  const module = wb.registerModule(createSessionsModule());
  expect(wb.resources.getKind("session")).toBeDefined();
  expect(wb.resources.getKind("session-draft")).toBeDefined();
  expect(wb.views.listViews()).toEqual([]);
  expect(wb.modePlacements.listPlacements()).toEqual([]);
  expect(wb.pages.getPage(workbenchPages.session.id)).toBeUndefined();
  module.dispose();
});

test("legacy URLs and saved panels reuse the provider view without duplicate Add choices", () => {
  const wb = createWorkbench();
  const module = wb.registerModule(createSessionsModule());
  const view = wb.views.registerView({
    id: contributionRefId(sessionBrowser.views.conversation),
    title: "Session",
    body: { kind: "react", render: () => null },
  });
  for (const ref of [workbenchPages.session, workbenchPages.newSession, workbenchPages.sessionComposer]) {
    expect(wb.pages.getPage(ref.id)?.main).toMatchObject({ kind: "view", view: sessionBrowser.views.conversation });
  }
  expect(wb.modePlacements.getPlacement(workbenchPanels.projectSession)).toMatchObject({
    id: "dashboard.session-bubble.project",
    addableIn: [],
    item: { kind: "binding", binding: { view: sessionBrowser.views.conversation, cardinality: "many" } },
  });
  expect(wb.views.listViews().map((item) => item.id)).toEqual([contributionRefId(sessionBrowser.views.conversation)]);
  view.dispose();
  expect(wb.modePlacements.listPlacements()).toEqual([]);
  expect(wb.pages.getPage(workbenchPages.session.id)).toBeUndefined();
  const enabledAgain = wb.views.registerView({
    id: contributionRefId(sessionBrowser.views.conversation),
    title: "Session",
    body: { kind: "react", render: () => null },
  });
  expect(wb.pages.getPage(workbenchPages.session.id)?.main).toMatchObject({ view: sessionBrowser.views.conversation });
  module.dispose();
  enabledAgain.dispose();
});

test("deprecated commands pass canonical context and parameters to public provider commands", async () => {
  const wb = createWorkbench();
  const calls: unknown[] = [];
  wb.commands.registerCommand(
    { id: contributionRefId(sessionBrowser.commands.create), label: "New session" },
    {
      execute: (args, context) => {
        calls.push({ args, resource: context?.resource });
      },
    },
  );
  const module = wb.registerModule(createSessionsModule());
  const resource = { type: "session", extensionId: "pstdio", id: "s" };
  await wb.commands.executeCommand(
    dashboardCommandIds.createSession,
    {
      workspace: { type: "workspace", id: "w", device: { id: "device", name: "Laptop", ownerId: "owner" } },
      harnessId: "agent",
      replacePanel: { kind: "page" },
    },
    { resource },
  );
  expect(calls).toEqual([
    {
      resource,
      args: expect.objectContaining({ workspaceId: "w", deviceId: "device", harnessId: "agent", replace: true }),
    },
  ]);
  module.dispose();
});

const productionProvider = async () => {
  const { resolve } = await import("node:path");
  const { loadExtensionSources, normalizeExtensionSources } = await import("pstdio-extensions");
  const { createWorkbenchExtensionMetadata } = await import("pstdio-extensions/workbench");
  const loaded = await loadExtensionSources({
    extensionPackages: [
      { path: resolve(import.meta.dir, "../../../../../extensions/pstdio-session-browser"), sourceKind: "local_path" },
    ],
  });
  const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
  expect(runtime.diagnostics).toEqual([]);
  return { runtime, metadata: createWorkbenchExtensionMetadata({ runtime }) };
};

test("legacy switch and rename collect the actual provider's missing parameters", async () => {
  const { metadata } = await productionProvider();
  const { registerWorkbenchExtensionContributions } = await import("@pstdio/workbench/extensions");
  const wb = createWorkbench();
  const module = wb.registerModule(createSessionsModule());
  const calls: unknown[] = [];
  const provider = registerWorkbenchExtensionContributions({
    workbench: wb,
    projectId: "p",
    metadata,
    executeCommand: (commandId, body) => {
      calls.push({ commandId, body });
      return {
        commandId,
        extensionId: "pstdio.pstdio-session-browser",
        outcome: { ok: true, status: "success", value: {} },
      };
    },
  });
  try {
    const resource = { type: "session", extensionId: "pstdio", projectId: "p", id: "saved", label: "Saved" };
    await wb.commands.executeCommand(dashboardCommandIds.switchSession, undefined, { resource });
    expect(calls).toEqual([]);
    expect(wb.commandPalette.getParamsRequest()).toMatchObject({
      record: {
        command: {
          id: "pstdio.pstdio-session-browser.command.switch",
          params: { sessionId: { type: "select", required: true } },
        },
      },
      context: { resource },
    });
    wb.commandPalette.clearParams();
    await wb.commands.executeCommand(dashboardCommandIds.renameSession, undefined, { resource });
    expect(calls).toEqual([]);
    expect(wb.commandPalette.getParamsRequest()).toMatchObject({
      record: {
        command: {
          id: "pstdio.pstdio-session-browser.command.rename",
          params: { title: { type: "text", required: true } },
        },
      },
      args: { sessionId: "saved" },
      context: { resource },
    });
    await wb.commands.executeCommand(dashboardCommandIds.renameSession, { title: "Updated" }, { resource });
    expect(calls).toMatchObject([
      {
        commandId: "pstdio.pstdio-session-browser.command.rename",
        body: { params: { sessionId: "saved", title: "Updated" }, resource },
      },
    ]);
  } finally {
    provider.dispose();
    module.dispose();
  }
});

test("legacy saved panel and page use the installed provider's tab status and New/Switch actions", async () => {
  const { metadata, runtime } = await productionProvider();
  const { registerWorkbenchExtensionContributions } = await import("@pstdio/workbench/extensions");
  const { createMemoryStorage, makeCommandContext } = await import("@pstdio/sdk/testing");
  const wb = createWorkbench();
  const module = wb.registerModule(createSessionsModule());
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { sessions: { get: async () => ({ id: "saved", title: "Saved", status: "completed" }) as never } },
  });
  const provider = registerWorkbenchExtensionContributions({
    workbench: wb,
    projectId: "p",
    metadata,
    executeCommand: async (commandId, body) => {
      const handler = runtime.privateHandlers.find((item) => item.id === commandId);
      const value = handler ? await handler.handler(ctx, body.params ?? {}) : {};
      return {
        commandId,
        extensionId: "pstdio.pstdio-session-browser",
        outcome: { ok: true, status: "success", value },
      };
    },
  });
  try {
    const resource = { type: "session", extensionId: "pstdio", projectId: "p", id: "saved", label: "Saved" };
    const instance = {
      instanceId: "restored-legacy-panel",
      resource,
      placementIdentity: {
        kind: "mode",
        modeId: "project",
        placementId: "dashboard.session-bubble.project",
        instanceKey: "saved",
      },
    } as import("@pstdio/workbench").WorkbenchPanelInstance;
    const tab = wb.modePlacements.getPlacement(workbenchPanels.projectSession)?.tab;
    const main = wb.pages.getPage(workbenchPages.session.id)?.main;
    expect(tab).toBeDefined();
    expect(main?.kind === "view" && main.tab).toBeDefined();
    const subscriptions = [tab!.subscribe?.(() => {})];
    try {
      tab!.getSnapshot(instance);
      await new Promise((resolve) => setImmediate(resolve));
      for (const presentation of [tab, main?.kind === "view" ? main.tab : undefined]) {
        const snapshot = presentation!.getSnapshot(instance);
        expect(snapshot).toMatchObject({ label: "Saved", indicator: { label: "Session status: completed" } });
        expect(snapshot.menu?.[0]?.rows.map((row) => row.id)).toEqual(["new-session", "switch-session"]);
      }
    } finally {
      for (const subscription of subscriptions) {
        if (typeof subscription === "function") subscription();
        else subscription?.dispose();
      }
    }
  } finally {
    provider.dispose();
    module.dispose();
  }
});

test("legacy session opening keeps the active extension page and uses its Side placement", async () => {
  const { registerSessionProvider } = await import("./session-provider.fixture");
  const wb = createWorkbench();
  wb.registerModule(createSessionsModule());
  const provider = registerSessionProvider(wb, {
    sessions: { get: async () => ({ id: "saved", title: "Saved", status: "completed" }) as never },
  });
  try {
    wb.pageLocations.setProject("project-1");
    wb.modes.registerMode({ id: "notes", panels: ["main", "side"], activate() {} });
    wb.views.registerView({ id: "notes", title: "Notes", body: { kind: "react", render: () => null } });
    const page = { kind: "page" as const, extensionId: "notes", id: "notes" };
    wb.pages.registerPage({
      id: "notes",
      ref: page,
      modeId: "notes",
      path: "notes",
      main: {
        kind: "view",
        view: { kind: "view", id: "notes" },
        cardinality: "one",
      },
      slots: [],
    });
    await wb.navigation.openTarget({ kind: "page", page });
    const main = wb.layout.getActivePanel("main");
    await wb.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: { type: "session", extensionId: "pstdio", id: "saved", projectId: "project-1" },
    });
    expect(wb.modes.getActiveModeId()).toBe("notes");
    expect(wb.layout.getActivePanel("main")).toEqual(main);
    expect(wb.layout.listPanelInstances("side").map((panel) => panel.resource?.id)).toContain("saved");
  } finally {
    provider.dispose();
    await wb.dispose();
  }
});
