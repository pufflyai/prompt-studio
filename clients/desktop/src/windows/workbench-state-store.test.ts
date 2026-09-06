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

    expect(store.getState()).toEqual({ pageLocations: {} });
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
        sessionDrafts: { "session-one": "private draft" },
      }),
    );

    const store = new DesktopWorkbenchStateStore(path);

    expect(store.getState()).toEqual({ pageLocations: {}, selectedProjectId: "project-one" });
  });
});
