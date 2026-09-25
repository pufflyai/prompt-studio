import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopWorkbenchStateStore } from "./workbench-state-store";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe("DesktopWorkbenchStateStore", () => {
  test("persists dashboard workbench values across store instances", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-state-"));
    roots.push(root);
    const path = join(root, "workbench-state.json");

    const first = new DesktopWorkbenchStateStore(path);
    first.setSelectedProjectId("project-one");
    first.setPageLocation("project-one", '{"version":1,"location":{"page":{"kind":"page","id":"workspaces"}}}');

    expect(new DesktopWorkbenchStateStore(path).getState()).toEqual({
      kanbanViews: {},
      pageLocations: {
        "project-one": '{"version":1,"location":{"page":{"kind":"page","id":"workspaces"}}}',
      },
      selectedProjectId: "project-one",
    });
  });

  test("removes cleared values", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-state-"));
    roots.push(root);
    const store = new DesktopWorkbenchStateStore(join(root, "workbench-state.json"));

    store.setSelectedProjectId("project-one");
    store.setSelectedProjectId(null);

    expect(store.getState()).toEqual({ pageLocations: {}, kanbanViews: {} });
  });

  test("does not load or persist session drafts", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-state-"));
    roots.push(root);
    const path = join(root, "workbench-state.json");
    writeFileSync(
      path,
      JSON.stringify({
        selectedProjectId: "project-one",
        pageLocations: {},
        kanbanViews: {},
        sessionDrafts: { "session-one": "private draft" },
      }),
    );

    const store = new DesktopWorkbenchStateStore(path);

    expect(store.getState()).toEqual({ pageLocations: {}, kanbanViews: {}, selectedProjectId: "project-one" });
  });
});

test("persists and removes project-scoped kanban snapshots across desktop restarts", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-views-"));
  roots.push(root);
  const path = join(root, "workbench-state.json");
  const key = "pstdio/ui/kanban-renderer/tickets:project:one";
  const otherKey = "pstdio/ui/kanban-renderer/tickets:project:two";
  const first = new DesktopWorkbenchStateStore(path);
  first.setKanbanView(key, '{"activeViewId":"saved"}');
  first.setKanbanView(otherKey, '{"activeViewId":"other"}');
  const restarted = new DesktopWorkbenchStateStore(path);
  expect(restarted.getState().kanbanViews[key]).toBe('{"activeViewId":"saved"}');
  restarted.setKanbanView(key, null);
  expect(new DesktopWorkbenchStateStore(path).getState().kanbanViews).toEqual({
    [otherKey]: '{"activeViewId":"other"}',
  });
});
