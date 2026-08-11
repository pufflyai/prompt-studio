import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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
    first.setItem("dashboard-wb:selected-project:global", "project-one");
    first.setItem("dashboard-wb:last-resource:project-one", '{"kind":"workspace","uri":"workspace://one"}');

    expect(new DesktopWorkbenchStateStore(path).getAll()).toEqual({
      "dashboard-wb:last-resource:project-one": '{"kind":"workspace","uri":"workspace://one"}',
      "dashboard-wb:selected-project:global": "project-one",
    });
  });

  test("removes cleared values", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-state-"));
    roots.push(root);
    const store = new DesktopWorkbenchStateStore(join(root, "workbench-state.json"));

    store.setItem("dashboard-wb:selected-project:global", "project-one");
    store.setItem("dashboard-wb:selected-project:global", null);

    expect(store.getAll()).toEqual({});
  });
});
