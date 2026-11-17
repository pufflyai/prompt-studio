import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { registerSessionResourceSync } from "./session-resource-sync";

test.each([
  "delete",
  "archive",
] as const)("session %s runs shared resource cleanup and preserves a foreign binding", (action) => {
  const w = createWorkbench();
  const projectId = `session-removal-${action}`;
  selectDashboardProject(w, { id: projectId, name: "Removal" });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "session", title: "Session", body: { kind: "react", render: () => null } });
  const page = { kind: "page", id: "home", extensionId: "test" } as const;
  w.pages.registerPage({
    id: "home",
    ref: page,
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "session" }, cardinality: "one" },
    slots: [],
  });
  w.pageLocations.setProject(projectId);
  w.pageLocations.navigate({ kind: "page", page });
  w.shellPlacements.registerPlacement({
    id: "sessions",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "session" },
        kinds: [{ kind: "resource-kind", id: "session" }],
        cardinality: "many",
      },
    },
  });
  const session = { type: "session", id: `same-id-${action}`, projectId, extensionId: "pstdio" };
  const variants = [
    session,
    { type: "session", id: session.id, extensionId: "pstdio" },
    { type: "session", id: session.id, projectId },
    { type: "session", id: session.id },
  ];
  const foreign = [
    { ...session, extensionId: "foreign" },
    { ...session, projectId: "foreign" },
  ];
  for (const resource of [...variants, ...foreign])
    w.shellPlacements.openPlacement({ placementId: "sessions", resource, open: "pin" });
  const row = { id: session.id, project_id: projectId, title: "Removed", status: "completed", archived: false };
  getWriter("sessions")!.upsert(row);
  const unsubscribe = registerSessionResourceSync(w as WorkbenchModuleContext);
  const removed: unknown[] = [];
  w.resources.onWillRemove((resource) => {
    removed.push(resource);
    return [];
  });
  try {
    expect(w.getOpenResources()).toHaveLength(6);
    const version = w.resources.getRemovalVersion();
    if (action === "delete") getWriter("sessions")!.remove(session.id);
    else getWriter("sessions")!.upsert({ ...row, archived: true });
    const remaining = w.getOpenResources();
    for (const resource of variants) {
      expect(remaining).not.toContainEqual(resource);
      expect(w.resources.wasRemovedSince(resource, version)).toBe(true);
    }
    for (const resource of foreign) expect(remaining).toContainEqual(resource);
    expect(remaining).toHaveLength(2);
    expect(removed).toEqual(variants);
  } finally {
    unsubscribe();
    getWriter("sessions")!.remove(session.id);
    w.dispose();
  }
});
