// Runs against the packed workbench archive, without repository source aliases.
export const workbenchOwnershipConsumer = `
import { createWorkbench } from "@pstdio/workbench";
const packagePage = (id: string) => ({ kind: "page" as const, extensionId: "package-test", id });
const workbench = createWorkbench({ startPage: packagePage("collection") });
workbench.modes.registerMode({ id: "package-test", activate() {} });
workbench.views.registerView({ id: "empty", title: "Empty", body: { kind: "react", render: () => null } });
workbench.views.registerView({ id: "session", title: "Session", instancePolicy: "per-resource", body: { kind: "react", render: () => null } });
const pageRegistrations = new Map<string, { dispose(): void }>();
for (const id of ["collection", "workspace"]) pageRegistrations.set(id, workbench.pages.registerPage({
  id, ref: packagePage(id), path: id, modeId: "package-test",
  ...(id === "workspace" ? { parentId: "collection", resource: { kinds: [{ kind: "resource-kind" as const, id: "workspace" }] } } : {}),
  main: { kind: "panels", empty: { kind: "view", id: "empty" } }, slots: [],
}));
const sessionPanel = { kind: "placement" as const, extensionId: "package-test", id: "sessions" };
workbench.modePlacements.registerPlacement({
  id: "sessions", ref: sessionPanel, modeId: "package-test", region: "side",
  item: { kind: "binding", binding: { kinds: [{ kind: "resource-kind", id: "session" }], view: { kind: "view", id: "session" }, cardinality: "many" } },
});
const workspace = { type: "workspace", id: "removed" };
const session = { type: "session", id: "foreign", metadata: { workspaceId: "valid" } };
const openSession = { kind: "panel" as const, panel: sessionPanel, resource: session, open: "pin" as const };
const assertOwner = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const allTabs = () => Object.values(workbench.layout.getLayout().regions).flatMap((region) => region.widgets);
workbench.pageLocations.setProject("package-project");
workbench.pageLocations.navigate({ kind: "page", page: packagePage("workspace"), resource: workspace });
await workbench.navigation.openTarget(openSession);
const tab = allTabs().find((tab) => tab.resource?.id === session.id)!;
workbench.movePanel(tab.widgetId, "main");
workbench.resources.removed(workspace);
assertOwner(workbench.pages.store.getState().activePageId === "collection", "Removed owner did not fall back");
assertOwner(!allTabs().some((tab) => tab.resource?.id === session.id), "Foreign tab survived owner deletion");
assertOwner(!workbench.pageLocations.navigate({ kind: "page", page: packagePage("workspace"), resource: workspace }).ok, "Deleted page reopened");
await workbench.navigation.openTarget(openSession);
await workbench.resetPageLayout();
await workbench.resetModeLayout();
const reopened = allTabs().filter((tab) => tab.resource?.id === session.id);
assertOwner(reopened.length === 1 && reopened[0]?.resource?.metadata?.workspaceId === "valid", "Reset lost or duplicated the foreign session binding");
workbench.pageLocations.navigate({ kind: "page", page: packagePage("workspace"), resource: { ...workspace, id: "valid" } });
const moved = allTabs().find((tab) => tab.resource?.id === session.id)!;
workbench.movePanel(moved.widgetId, "main");
pageRegistrations.get("workspace")!.dispose();
await workbench.navigation.openTarget(openSession);
assertOwner(allTabs().filter((tab) => tab.resource?.id === session.id).length === 1, "An unregistered owner claimed the foreign editor");
await workbench.dispose();

for (const leaveProject of [false, true]) {
  const resetWorkbench = createWorkbench();
  resetWorkbench.modes.registerMode({ id: "reset-tools", activate() {} });
  resetWorkbench.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
  const resetPage = packagePage("reset-tools");
  resetWorkbench.pages.registerPage({
    id: "reset-tools", ref: resetPage, path: "reset-tools", modeId: "reset-tools",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "tool" } },
    slots: ["one", "two"].map((id) => ({
      id, region: "bottom",
      item: { kind: "binding", binding: {
        kinds: [{ kind: "resource-kind", id: "session" }], view: { kind: "view", id: "tool" }, cardinality: "one",
        add: { kind: "command", target: { command: { kind: "command", id: "create-" + id } } },
      } },
    })),
  });
  let releaseCreation!: () => void;
  let signalCreation!: () => void;
  const creationReady = new Promise<void>((resolve) => { releaseCreation = resolve; });
  const creationStarted = new Promise<void>((resolve) => { signalCreation = resolve; });
  const creationOwners: string[] = [];
  for (const id of ["one", "two"]) resetWorkbench.commands.registerCommand({ id: "create-" + id, label: id }, {
    execute: async (_args, context) => {
      creationOwners.push(resetWorkbench.pages.store.getState().projectId + ":" + id);
      signalCreation();
      await creationReady;
      await context!.navigation!.openPanel({
        panel: { kind: "page-slot", page: resetPage, id }, resource: { type: "session", id: id + "-" + context!.resource!.id },
      });
    },
  });
  resetWorkbench.pageLocations.setProject("package-project");
  const visitResetOwner = (id: string) => resetWorkbench.navigation.openPage({ page: resetPage, resource: { type: "workspace", id } });
  await visitResetOwner("alpha");
  const resetCompletion = resetWorkbench.resetPageLayout();
  await creationStarted;
  if (leaveProject) resetWorkbench.pageLocations.setProject("other-project");
  await visitResetOwner("beta");
  releaseCreation();
  await resetCompletion;
  assertOwner(resetWorkbench.layout.getLayout().regions.bottom.widgets.length === 0, "Reset created tools in the new owner");
  if (leaveProject) {
    assertOwner(creationOwners.join(",") === "package-project:one", "Reset launched another producer in the newly selected project");
  } else {
    await visitResetOwner("alpha");
    const resetResources = resetWorkbench.layout.getLayout().regions.bottom.widgets.map((tab) => tab.resource?.id);
    assertOwner(resetResources.join(",") === "one-alpha,two-alpha", "Reset skipped an initiating-owner preset after navigation");
  }
  await resetWorkbench.dispose();
}

const legacyWorkbench = createWorkbench();
legacyWorkbench.modes.registerMode({
  id: "legacy", panels: ["main", "secondary", "side"], activate() {},
  listAddablePanels: () => [{ panelId: "player", region: "secondary", allowedRegions: ["secondary"] }],
});
legacyWorkbench.modes.setActiveMode("legacy");
legacyWorkbench.layout.registerPanel({ id: "player", title: "Player", region: "secondary", rendererId: "player", singleton: true });
legacyWorkbench.layout.openWidget("player");
const legacyLayout = legacyWorkbench.layout.getLayout();
const legacyTab = legacyLayout.regions.secondary.widgets[0]!;
legacyWorkbench.layout.restoreLayout({ ...legacyLayout, regions: { ...legacyLayout.regions,
  secondary: { ...legacyLayout.regions.secondary, widgets: [] },
  side: { ...legacyLayout.regions.side, widgets: [legacyTab] },
} });
assertOwner(legacyWorkbench.layout.getLayout().regions.secondary.widgets.some((tab) => tab.widgetId === legacyTab.widgetId), "Restoration ignored legacy allowedRegions");
assertOwner(legacyWorkbench.layout.getLayout().regions.side.widgets.length === 0, "Restoration retained an illegal legacy destination");
await legacyWorkbench.dispose();
`;
