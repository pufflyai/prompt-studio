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
`;
