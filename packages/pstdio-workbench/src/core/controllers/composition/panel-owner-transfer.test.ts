import { expect, test } from "bun:test";
import { toPanelInstance } from "../../registries/layout/panel-api";
import { harness, navigate, openFile, page, panel, resource } from "./placement-lifecycle-test-support";

test("a closed transferred tab can reopen through its original declaration", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("file"));
  const file = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(file.widgetId, "side");
  w.closePlacement(w.layout.getLayout().regions.side.widgets[0]!.placementIdentity!);
  await w.navigation.openTarget(openFile("file"));
  expect(w.layout.getLayout().regions.main.widgets[0]?.resource).toEqual(resource("file"));
});

test("opening a transferred declaration selects the existing tab in its actual destination", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("file"));
  const file = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(file.widgetId, "side");
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  w.sidePanel.setMode("closed");
  await w.navigation.openTarget(openFile("file"));
  expect(w.layout.getLayout().activeWidgetId).toBe(file.widgetId);
  expect(w.layout.getLayout().regions.side.activeWidgetId).toBe(file.widgetId);
  expect(w.sidePanel.getMode()).toBe("attached");
  expect(w.layout.getLayout().regions.main.widgets).toHaveLength(0);
});

test("transferred tabs rehydrate live tab callbacks after serialization", async () => {
  const saved = new Map();
  const create = (customTab = true) => {
    const w = harness(saved);
    w.modePlacements.registerPlacement({
      id: "tools",
      ref: { kind: "placement", extensionId: "test", id: "tools" },
      modeId: "edit",
      region: "side",
      item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" },
      ...(customTab ? { tab: { getSnapshot: () => ({ label: "Live tools" }) } } : {}),
    });
    return w;
  };
  const source = create();
  await source.navigation.openTarget(navigate("alpha"));
  const tab = source.layout.getLayout().regions.side.widgets[0]!;
  source.movePanel(tab.widgetId, "main");
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create();
  await restored.navigation.openTarget(navigate("alpha"));
  const placement = restored.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.widgetId)!;
  expect(placement.tab?.getSnapshot(toPanelInstance(placement))).toEqual({ label: "Live tools" });
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const withoutCustomization = create(false);
  await withoutCustomization.navigation.openTarget(navigate("alpha"));
  expect(
    withoutCustomization.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.widgetId)?.tab,
  ).toBeUndefined();
});

test("a transferred tab cannot return after its contribution is unregistered", async () => {
  const w = harness();
  const registration = w.modePlacements.registerPlacement({
    id: "tools",
    ref: { kind: "placement", extensionId: "test", id: "tools" },
    modeId: "edit",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" },
  });
  await w.navigation.openTarget(navigate("alpha"));
  const tab = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(tab.widgetId, "main");
  await w.navigation.openTarget(navigate("beta"));
  registration.dispose();
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.main.widgets.some((p) => p.widgetId === tab.widgetId)).toBe(false);
});

test("a compound navigation opens a new tab while entering a page with a saved layout", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ kind: "compound", targets: [navigate("alpha"), openFile("new")] });
  expect(w.layout.getLayout().regions.main.widgets.some((p) => p.resource?.id === "new")).toBe(true);
});

test("clearing an inactive page owner in its persistence adapter removes its saved tabs", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("file"));
  await w.navigation.openTarget(navigate("beta"));
  const scope = [...saved.keys()].find(
    (key) =>
      key?.includes("resource/") &&
      saved.get(key).regions.main.widgets.some((p: { resource?: { id: string } }) => p.resource?.id === "file"),
  );
  expect(scope).toBeDefined();
  saved.delete(scope);
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.main.widgets.some((p) => p.resource?.id === "file")).toBe(false);
});

const registerReviewPage = (w: ReturnType<typeof harness>) => {
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "review",
    ref: page("review"),
    path: "review",
    modeId: "review",
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [],
  });
};
const review = { kind: "page" as const, page: page("review") };
const modeFile = { kind: "panel" as const, panel, resource: resource("mode-file"), open: "pin" as const };

test("clearing an inactive mode owner in its persistence adapter removes its saved tabs", async () => {
  const saved = new Map();
  const w = harness(saved);
  registerReviewPage(w);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(modeFile);
  await w.navigation.openTarget(review);
  saved.delete("project/project/owner/mode/edit");
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.side.widgets.some((p) => p.resource?.id === "mode-file")).toBe(false);
});

test("a compound navigation retains staged page and mode tabs when revisiting their owners", async () => {
  const w = harness();
  registerReviewPage(w);
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({
    kind: "compound",
    targets: [
      navigate("alpha"),
      { ...openFile("file"), open: "pin" },
      modeFile,
      review,
      navigate("beta"),
      navigate("alpha"),
    ],
  });
  expect(w.layout.getLayout().regions.main.widgets.some((p) => p.resource?.id === "file")).toBe(true);
  expect(w.layout.getLayout().regions.side.widgets.some((p) => p.resource?.id === "mode-file")).toBe(true);
});
