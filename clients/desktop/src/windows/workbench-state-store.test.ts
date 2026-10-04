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
  test("keeps the saved project and page when loading a desktop state from an earlier release", () => {
    const path = createStatePath();
    const location = JSON.stringify({ version: 1, location: { page: { id: "sessions", kind: "page" } } });
    writeFileSync(path, JSON.stringify({ selectedProjectId: "project-a", pageLocations: { "project-a": location } }));
    expect(new DesktopWorkbenchStateStore(path).getState()).toEqual({
      values: {
        "dashboard-wb2:selected-project:global": "project-a",
        "dashboard-wb2:page-location:project-a": location,
      },
    });
  });

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

  test("persists the startup appearance across store instances", () => {
    const path = createStatePath();
    const appearance = {
      themeId: "lab.monokai",
      mode: "dark" as const,
      tokens: { "colors.bg": "#272822", "colors.fg": "rgb(248, 248, 242)" },
      backgroundColor: "rgb(39, 40, 34)",
    };

    const first = new DesktopWorkbenchStateStore(path);
    first.setItem("theme-preference", "lab.monokai");
    first.setStartupAppearance(appearance);
    first.flush();
    const restored = new DesktopWorkbenchStateStore(path);

    expect(restored.getState()).toEqual({ values: { "theme-preference": "lab.monokai" } });
    expect(restored.getStartupAppearance()).toEqual(appearance);
  });

  test("rejects startup appearances that are not safe in the lifecycle document", () => {
    const store = new DesktopWorkbenchStateStore(createStatePath());
    const appearance = { themeId: "pstdio-dark", mode: "dark", tokens: {}, backgroundColor: "rgb(7, 9, 14)" };

    expect(() => store.setStartupAppearance({ ...appearance, mode: "sepia" })).toThrow();
    expect(() => store.setStartupAppearance({ ...appearance, themeId: 'dark" onload="x' })).toThrow();
    expect(() => store.setStartupAppearance({ ...appearance, backgroundColor: "url(https://example.com)" })).toThrow();
    expect(store.getStartupAppearance()).toBeUndefined();
  });

  test("drops only the theme tokens that are not safe in the lifecycle document", () => {
    const store = new DesktopWorkbenchStateStore(createStatePath());

    store.setStartupAppearance({
      themeId: "lab.monokai",
      mode: "dark",
      tokens: { "colors.bg": "red; background-image: url(x)", "colors.fg": "#f8f8f2" },
      backgroundColor: "rgb(39, 40, 34)",
    });

    expect(store.getStartupAppearance()?.tokens).toEqual({ "colors.fg": "#f8f8f2" });
  });

  test("drops an invalid saved startup appearance", () => {
    const path = createStatePath();
    writeFileSync(
      path,
      JSON.stringify({
        values: { "theme-preference": "pstdio-dark" },
        startupAppearance: { themeId: "pstdio-dark", mode: "sepia", tokens: {}, backgroundColor: "rgb(7, 9, 14)" },
      }),
    );

    const store = new DesktopWorkbenchStateStore(path);

    expect(store.getState()).toEqual({ values: { "theme-preference": "pstdio-dark" } });
    expect(store.getStartupAppearance()).toBeUndefined();
  });
});
