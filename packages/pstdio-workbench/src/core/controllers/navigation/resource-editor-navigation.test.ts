import { expect, test } from "bun:test";
import { modePlacementContributionId } from "../../registries/views/view-placement";
import type { WorkbenchSnapshot } from "../../workbench-core-types";
import { harness, navigate, openFile, panel, resource } from "../composition/placement-lifecycle-test-support";

const uniqueWorkbench = (saved = new Map(), input?: Parameters<typeof harness>[1]) => {
  const w = harness(saved, input);
  w.views.getView("editor")!.instancePolicy = "per-resource";
  return w;
};
const tabs = (w: ReturnType<typeof harness>) => Object.values(w.layout.getLayout().regions).flatMap((r) => r.widgets);

test("opening a new declared panel reveals and focuses its available destination", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  w.sidePanel.setMode("closed");
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("a"), open: "pin" });
  const editor = w.layout.getLayout().regions.side.widgets.find((tab) => tab.resource?.id === "a")!;
  expect(editor).toBeDefined();
  expect(w.sidePanel.getMode()).toBe("attached");
  expect(w.layout.getLayout().activeWidgetId).toBe(editor.widgetId);
  expect(w.focus.getActiveRegion()).toBe("side");
});

test("explicit opens reuse a resource editor across declarations and page owners", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  const editor = tabs(w).find((t) => t.resource?.id === "a")!;
  w.movePanel(editor.widgetId, "side");
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(openFile("a"));
  expect(
    tabs(w)
      .filter((t) => t.resource?.id === "a")
      .map((t) => t.widgetId),
  ).toEqual([editor.widgetId]);
  expect(w.layout.getLayout().activeWidgetId).toBe(editor.widgetId);
  expect(w.focus.getActiveRegion()).toBe("side");
});

test("opening a moved editor activates its inactive page owner, including after reload", async () => {
  const saved = new Map();
  const w = uniqueWorkbench(saved);
  await w.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel", panel, resource: resource("a"), open: "pin" } as const;
  await w.navigation.openTarget(target);
  const editor = tabs(w).find((t) => t.resource?.id === "a")!;
  w.movePanel(editor.widgetId, "main");
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(target);
  expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
  expect(w.layout.getLayout().activeWidgetId).toBe(editor.widgetId);
  await w.navigation.openTarget(navigate("beta"));
  const restored = uniqueWorkbench(saved);
  await restored.navigation.openTarget(navigate("beta"));
  await restored.navigation.openTarget(target);
  expect(restored.pages.store.getState().location?.resource?.id).toBe("alpha");
  expect(restored.layout.getLayout().activeWidgetId).toBe(editor.widgetId);
});

test("snapshot persistence finds resource editors in inactive page owners after reload", async () => {
  const saved = new Map<string | undefined, WorkbenchSnapshot>();
  const persistence = {
    saved,
    getSnapshot: (scope?: string) => saved.get(scope),
    setSnapshot: (snapshot: WorkbenchSnapshot, scope?: string) => saved.set(scope, snapshot),
    listScopes(projectId: string) {
      return [...this.saved.keys()].filter((scope): scope is string =>
        Boolean(scope?.startsWith(`project/${projectId}/`)),
      );
    },
  };
  const w = uniqueWorkbench(new Map(), { persistence });
  w.pages.getPage("workspace")!.regionSettings = { bottom: {} };
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("a"), open: "pin" });
  const editor = tabs(w).find((t) => t.resource?.id === "a")!;
  w.movePanel(editor.widgetId, "bottom");
  await w.navigation.openTarget(navigate("beta"));
  const restored = uniqueWorkbench(new Map(), { persistence });
  restored.pages.getPage("workspace")!.regionSettings = { bottom: {} };
  await restored.navigation.openTarget(navigate("beta"));
  await restored.navigation.openTarget(openFile("a"));
  expect(restored.pages.store.getState().location?.resource?.id).toBe("alpha");
  expect(restored.layout.getLayout().regions.bottom.activeWidgetId).toBe(editor.widgetId);
  expect(tabs(restored).filter((t) => t.resource?.id === "a")).toHaveLength(1);
});

test("a forbidden closed destination rejects a compound open without partial state", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  const editor = tabs(w).find((t) => t.resource?.id === "a")!;
  w.movePanel(editor.widgetId, "side");
  w.sidePanel.setMode("closed");
  w.modes.getMode("edit")!.panels = ["main"];
  const layout = w.layout.getLayout();
  const state = w.pages.store.getState();
  await expect(
    w.navigation.openTarget({ kind: "compound", targets: [navigate("beta"), openFile("a")] }),
  ).rejects.toThrow("cannot open");
  expect(w.layout.getLayout()).toBe(layout);
  expect(w.pages.store.getState()).toBe(state);
});

test("concurrent opens create one editor and closing removes it from lookup", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await Promise.all([
    w.navigation.openTarget(openFile("a")),
    w.navigation.openTarget({ kind: "panel", panel, resource: resource("a"), open: "pin" }),
  ]);
  const editors = tabs(w).filter((t) => t.resource?.id === "a");
  expect(editors).toHaveLength(1);
  w.movePanel(editors[0]!.widgetId, "side");
  w.closePlacement(tabs(w).find((t) => t.widgetId === editors[0]!.widgetId)!.placementIdentity!);
  await w.navigation.openTarget(openFile("a"));
  expect(w.layout.getLayout().regions.main.widgets.filter((t) => t.resource?.id === "a")).toHaveLength(1);
  expect(w.layout.getLayout().regions.side.widgets).toHaveLength(0);
});

test("one compound open creates one editor across multiple destinations", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({
    kind: "compound",
    targets: [openFile("a"), { kind: "panel", panel, resource: resource("a"), open: "pin" }],
  });
  expect(tabs(w).filter((t) => t.resource?.id === "a")).toHaveLength(1);
});

test("compound reuse preserves other opens and validates every target before commit", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("a"), open: "pin" });
  await w.navigation.openTarget({ kind: "compound", targets: [{ ...openFile("b"), open: "pin" }, openFile("a")] });
  expect(
    tabs(w)
      .filter((t) => t.viewId === "editor")
      .map((t) => t.resource?.id)
      .sort(),
  ).toEqual(["a", "b"]);
  const state = w.pages.store.getState();
  const layout = w.layout.getLayout();
  await expect(
    w.navigation.openTarget({
      kind: "compound",
      targets: [{ kind: "page", page: { kind: "page", extensionId: "test", id: "missing" } }, openFile("a")],
    }),
  ).rejects.toThrow("Unknown page");
  expect(w.pages.store.getState()).toBe(state);
  expect(w.layout.getLayout()).toBe(layout);
});

test("new editors cannot open an unavailable destination", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  w.sidePanel.setMode("closed");
  w.modes.getMode("edit")!.panels = ["main"];
  const state = w.pages.store.getState();
  const layout = w.layout.getLayout();
  const target = { kind: "panel", panel, resource: resource("b"), open: "pin" } as const;
  for (const operation of [target, { kind: "compound", targets: [navigate("beta"), target] }] as const) {
    await expect(w.navigation.openTarget(operation)).rejects.toThrow("cannot open");
    expect(w.pages.store.getState()).toBe(state);
    expect(w.layout.getLayout()).toBe(layout);
  }
});

test("low-level panel opens use the same resource editor lookup", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  const editor = tabs(w).find((t) => t.resource?.id === "a")!;
  w.movePanel(editor.widgetId, "secondary");
  w.layout.openPanel(modePlacementContributionId("shared"), {
    resource: resource("a"),
    strategy: { kind: "persistent" },
  });
  expect(
    tabs(w)
      .filter((t) => t.resource?.id === "a")
      .map((t) => t.widgetId),
  ).toEqual([editor.widgetId]);
  expect(w.layout.getLayout().regions.secondary.activeWidgetId).toBe(editor.widgetId);
});

test("pinning an existing editor through the layout API returns its updated instance", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  const editor = tabs(w).find((t) => t.resource?.id === "a")!;
  expect(editor.pinned).toBe(false);
  const opened = w.layout.openPanel(editor.contributionId, { resource: resource("a"), pinned: true });
  expect(opened.instanceId).toBe(editor.widgetId);
  expect(opened.pinned).toBe(true);
  expect(tabs(w).find((t) => t.widgetId === editor.widgetId)?.pinned).toBe(true);
});

test("compound reuse across inactive page owners finishes on the final editor owner", async () => {
  const w = uniqueWorkbench();
  w.pages.getPage("workspace")!.regionSettings = { bottom: {} };
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("a"), open: "pin" });
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ ...openFile("b"), open: "pin" });
  const b = tabs(w).find((t) => t.resource?.id === "b")!;
  w.movePanel(b.widgetId, "bottom");
  await w.navigation.openTarget(navigate("gamma"));
  await w.navigation.openTarget({ kind: "compound", targets: [openFile("a"), openFile("b")] });
  expect(w.pages.store.getState().location?.resource?.id).toBe("beta");
  expect(w.layout.getLayout().activeWidgetId).toBe(b.widgetId);
  await w.navigation.openTarget(openFile("a"));
  expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
  expect(tabs(w).filter((t) => t.resource?.id === "a")).toHaveLength(1);
});

test.each([
  "multiple",
  undefined,
] as const)("instance policy %s preserves independent owner instances", async (policy) => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = policy;
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("a"), open: "pin" });
  expect(tabs(w).filter((t) => t.resource?.id === "a")).toHaveLength(2);
});

test("moving the last Main editor immediately shows the collection fallback", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  const editor = tabs(w).find((t) => t.resource?.id === "a")!;
  w.movePanel(editor.widgetId, "side");
  expect(w.layout.getLayout().regions.main.widgets.map((t) => t.viewId)).toEqual(["empty"]);
  expect(w.layout.getLayout().activeWidgetId).toBe(editor.widgetId);
  w.resetLayout();
  expect(
    tabs(w)
      .filter((t) => t.resource?.id === "a")
      .map((t) => t.widgetId),
  ).toEqual([editor.widgetId]);
});

test("closing the last Main editor restores the collection fallback", async () => {
  const w = uniqueWorkbench();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  const editor = tabs(w).find((t) => t.resource?.id === "a")!;
  w.closePlacement(editor.placementIdentity!);
  expect(w.layout.getLayout().regions.main.widgets.map((t) => t.viewId)).toEqual(["empty"]);
});
