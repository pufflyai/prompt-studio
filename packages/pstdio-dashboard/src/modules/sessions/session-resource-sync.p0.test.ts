import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { registerSessionResourceSync } from "./session-resource-sync";

test.each(
  (["delete", "archive"] as const).flatMap((action) =>
    (["all", 0, 1, 2, 3] as const).map((variant) => [action, variant] as const),
  ),
)("session %s removes legacy variant %s and preserves foreign bindings", (action, variant) => {
  const w = createWorkbench();
  const projectId = `session-removal-${action}-${variant}`;
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
  const placed = [...(variant === "all" ? variants : [variants[variant]!]), ...foreign];
  for (const resource of placed) w.shellPlacements.openPlacement({ placementId: "sessions", resource, open: "pin" });
  const row = { id: session.id, project_id: projectId, title: "Removed", status: "completed", archived: false };
  getWriter("sessions")!.upsert(row);
  const unsubscribe = registerSessionResourceSync(w as WorkbenchModuleContext);
  const removed: unknown[] = [];
  w.resources.onWillRemove((resource) => {
    removed.push(resource);
    return [];
  });
  try {
    // Aliases reuse a viewer, so exercise each legacy shape separately while both
    // foreign identities remain open. Removal history must retire every alias.
    const placedResources = () => w.layout.listPanelInstances("side").map((panel) => panel.resource);
    if (variant === "all") {
      // References with and without the active project share a viewer; explicit owners remain distinct.
      expect(w.getOpenResources()).toHaveLength(4);
      expect(placedResources()).toEqual([variants[1], variants[3], ...foreign]);
    } else expect(placedResources()).toEqual(placed);
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
    expect(placedResources()).toEqual(foreign);
    expect(removed).toEqual(variants);
  } finally {
    unsubscribe();
    getWriter("sessions")!.remove(session.id);
    w.dispose();
  }
});

test("reconnecting a session list only retires newly archived sessions", () => {
  const w = createWorkbench();
  const projectId = "archive-snapshot-project";
  selectDashboardProject(w, { id: projectId, name: "Archive snapshot" });
  const writer = getWriter("sessions")!;
  const first = { id: "old-archive", project_id: projectId, archived: true };
  const second = { id: "new-archive", project_id: projectId, archived: false };
  const ref = (id: string) => ({ type: "session", id, projectId, extensionId: "pstdio" });
  const stop = registerSessionResourceSync(w as WorkbenchModuleContext);
  try {
    writer.truncateAndWrite([first, second]);
    expect(w.resources.wasRemovedSince(ref(first.id), 0)).toBe(true);
    const version = w.resources.getRemovalVersion();
    writer.truncateAndWrite([first, { ...second, archived: true }]);
    expect(w.resources.wasRemovedSince(ref(first.id), version)).toBe(false);
    expect(w.resources.wasRemovedSince(ref(second.id), version)).toBe(true);
    writer.upsert({ ...first, archived: false });
    const restored = w.resources.getRemovalVersion();
    writer.upsert(first);
    expect(w.resources.wasRemovedSince(ref(first.id), restored)).toBe(true);

    writer.upsert({ ...first, archived: false });
    const beforeSwitch = w.resources.getRemovalVersion();
    selectDashboardProject(w, { id: "different-project", name: "Other" });
    writer.upsert(first);
    selectDashboardProject(w, { id: projectId, name: "Archive snapshot" });
    writer.truncateAndWrite([first]);
    expect(w.resources.wasRemovedSince(ref(first.id), beforeSwitch)).toBe(true);
  } finally {
    stop();
    writer.remove(first.id);
    writer.remove(second.id);
    w.dispose();
  }
});
