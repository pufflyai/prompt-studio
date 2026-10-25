import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { navigateDashboardPage } from "./page-navigation";

for (const { type, page, root } of [
  { type: "session", page: workbenchPages.session, root: workbenchPages.sessions },
  { type: "session-draft", page: workbenchPages.newSession, root: workbenchPages.sessions },
  { type: "workspace", page: workbenchPages.workspace, root: workbenchPages.workspaces },
]) {
  test(`native ${type} navigation keeps one resource identity through metadata refresh and removal`, () => {
    const w = createWorkbench();
    w.modes.registerMode({ id: "project", activate() {} });
    w.views.registerView({ id: "viewer", title: "Viewer", body: { kind: "react", render: () => null } });
    w.pages.registerPage({
      id: root.id,
      ref: root,
      modeId: "project",
      path: root.id,
      main: { kind: "panels" },
      slots: [],
    });
    w.pages.registerPage({
      id: page.id,
      ref: page,
      modeId: "project",
      parentId: root.id,
      path: page.id,
      resource: { kinds: [{ kind: "resource-kind", id: type }] },
      main: { kind: "view", view: { kind: "view", id: "viewer" }, cardinality: "one" },
      slots: [],
    });
    selectDashboardProject(w, { id: "identity-project", name: "Identity" });
    navigateDashboardPage(w, { page, resource: { type, id: "a" } });
    const resource = { type, id: "a", extensionId: "pstdio", projectId: "identity-project" };
    expect(w.pages.store.getState().location?.resource).toMatchObject(resource);
    w.pageLocations.replay({ ...w.pages.store.getState().location!, resource: { ...resource, label: "A" } });
    expect(w.layout.getLayout().regions.main.widgets).toHaveLength(1);
    w.resources.removed(resource);
    expect(w.pages.store.getState().location?.page.id).toBe(root.id);
    expect(w.pages.store.getState().location?.resource).toBeUndefined();
    expect(w.layout.getLayout().regions.main.widgets).toEqual([]);
    w.dispose();
  });
}
