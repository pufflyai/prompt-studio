import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopWorkbenchStateStore } from "./workbench-state-store";

const roots: string[] = [];

const createStatePath = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-state-"));
  roots.push(root);
  return join(root, "workbench-state.json");
};

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe("DesktopWorkbenchStateStore", () => {
  test("persists workbench values across store instances", () => {
    const path = createStatePath();

    const first = new DesktopWorkbenchStateStore(path);
    first.setItem("dashboard-wb2:selected-project:global", "project-one");
    first.setItem("dashboard-wb2:layout:project/project-one", '{"version":5}');
    first.flush();

    expect(new DesktopWorkbenchStateStore(path).getState()).toEqual({
      values: {
        "dashboard-wb2:layout:project/project-one": '{"version":5}',
        "dashboard-wb2:selected-project:global": "project-one",
      },
    });
  });

  test("removes cleared values", () => {
    const path = createStatePath();
    const store = new DesktopWorkbenchStateStore(path);

    store.setItem("dashboard-wb2:selected-project:global", "project-one");
    store.setItem("dashboard-wb2:selected-project:global", null);
    store.flush();

    expect(new DesktopWorkbenchStateStore(path).getState()).toEqual({ values: {} });
  });

  test("loads only string values from the saved file", () => {
    const path = createStatePath();
    writeFileSync(path, JSON.stringify({ values: { kept: "yes", dropped: 1 } }));

    expect(new DesktopWorkbenchStateStore(path).getState()).toEqual({ values: { kept: "yes" } });
  });

  test("starts empty when the saved file cannot be read", () => {
    const path = createStatePath();
    writeFileSync(path, "{ interrupted");

    expect(new DesktopWorkbenchStateStore(path).getState()).toEqual({ values: {} });
  });
});
