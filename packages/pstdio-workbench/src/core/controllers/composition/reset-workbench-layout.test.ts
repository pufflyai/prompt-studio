import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { harness, navigate, page, panel, resource } from "./placement-lifecycle-test-support";

const setup = (saved = new Map<string | undefined, WorkbenchLayout>(), terminalAdd = false, terminalKind = "file") => {
  const core = harness(saved);
  core.pages.registerPage({
    id: "tools",
    ref: page("tools"),
    path: "tools",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    regionSettings: { aside: { edge: "right", size: { defaultPx: 240 } } },
    slots: [
      { id: "files", region: "main", item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" } },
      {
        id: "terminal",
        region: "bottom",
        item: {
          kind: "binding",
          binding: {
            ...(terminalAdd
              ? {
                  add: {
                    kind: "command" as const,
                    target: { command: { kind: "command" as const, id: "new-terminal" } },
                  },
                }
              : {}),
            kinds: [{ kind: "resource-kind", id: terminalKind }],
            view: { kind: "view", id: "editor" },
            cardinality: "one",
          },
        },
      },
    ],
  });
  core.modePlacements.registerPlacement({
    id: "player",
    ref: { kind: "placement", extensionId: "test", id: "player" },
    modeId: "edit",
    region: "secondary",
    item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" },
  });
  return core;
};
const open = (core: ReturnType<typeof setup>, id = "alpha") =>
  core.navigation.openTarget({ kind: "page", page: page("tools"), resource: { type: "workspace", id } });
const tabs = (core: ReturnType<typeof setup>) =>
  Object.values(core.layout.getLayout().regions).flatMap((r) => r.widgets);

test("page reset restores closed presets, preserves dropped tabs and mode choices, and clears only page choices", async () => {
  const core = setup();
  await open(core);
  const files = core.layout.getLayout().regions.main.widgets[0]!;
  core.closePlacement(files.placementIdentity!);
  await core.navigation.openTarget({ kind: "panel", panel, resource: resource("foreign-session"), open: "pin" });
  const session = core.layout.getLayout().regions.side.widgets[0]!;
  core.movePanel(session.widgetId, "main");
  core.repositionPanel("aside", "left");
  core.shell.setRegionSize("aside", 399);
  core.shell.setHeaderVisible("main", false);
  core.shell.setRegionOpen("bottom", true);
  core.shell.setHeaderVisible("side", false);
  core.repositionPanel("side", "left");
  core.layout.setRegionSize("side", 444);
  await core.commands.executeCommand("workbench.resetPageLayout");
  expect(tabs(core).filter((t) => t.widgetId === session.widgetId)).toHaveLength(1);
  expect(core.layout.getLayout().regions.main.widgets.map((t) => t.widgetId)).toContain(files.widgetId);
  expect(core.getPanelEdge("aside")).toBe("right");
  expect(core.layout.getLayout().regions.aside.size).toBeUndefined();
  expect(core.layout.getLayout().regions.main.headerVisible).toBeUndefined();
  expect(core.layout.getLayout().regions.bottom.visibility).toBeUndefined();
  expect(core.layout.getLayout().regions.side).toMatchObject({ size: 444, headerVisible: false });
  expect(core.getPanelEdge("side")).toBe("left");
  await core.dispose();
});

test("page reset leaves a moved Files preset with its owner once, including after reload", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const core = setup(saved);
  await open(core);
  const files = core.layout.getLayout().regions.main.widgets[0]!;
  core.movePanel(files.widgetId, "side");
  await core.commands.executeCommand("workbench.resetPageLayout");
  await core.navigation.openTarget(navigate("beta"));
  await open(core);
  await core.dispose();
  const restored = setup(saved);
  await open(restored);
  await restored.commands.executeCommand("workbench.resetPageLayout");
  expect(restored.layout.getLayout().regions.side.widgets.map((t) => t.widgetId)).toContain(files.widgetId);
  expect(tabs(restored).filter((t) => t.viewId === "editor" && t.resource?.type === "workspace")).toHaveLength(1);
  await restored.dispose();
});

test("mode reset restores Player and mode geometry without changing page choices or tab identities", async () => {
  const core = setup();
  await open(core);
  const files = core.layout.getLayout().regions.main.widgets[0]!;
  const player = core.layout.getLayout().regions.secondary.widgets[0]!;
  core.closePlacement(player.placementIdentity!);
  core.repositionPanel("aside", "left");
  core.shell.setHeaderVisible("main", false);
  core.repositionPanel("side", "left");
  core.repositionPanel("secondary", "top");
  core.setActionBarPosition("bottom");
  core.layout.setRegionSize("secondary", 350);
  core.sidePanel.setBubblePosition({ x: 0, y: 0 });
  core.shell.setRegionOpen("secondary", true);
  await core.commands.executeCommand("workbench.resetModeLayout");
  expect(core.layout.getLayout().regions.secondary.widgets[0]?.widgetId).toBe(player.widgetId);
  expect(core.layout.getLayout().regions.main.widgets[0]?.widgetId).toBe(files.widgetId);
  expect(core.getPanelEdge("aside")).toBe("left");
  expect(core.layout.getLayout().regions.main.headerVisible).toBe(false);
  expect(core.getPanelEdge("side")).toBe("right");
  expect(core.getPanelEdge("secondary")).toBe("bottom");
  expect(core.layout.getLayout().actionBarEdge).toBeUndefined();
  expect(core.layout.getLayout().regions.secondary.size).toBeUndefined();
  expect(core.layout.getLayout().regions.side.bubblePosition).toBeUndefined();
  await core.dispose();
});

test("a moved, closed preset restores its canonical resource at its declaration after reload", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const core = setup(saved);
  await open(core);
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "page-slot", page: page("tools"), id: "terminal" },
    resource: resource("original-terminal"),
  });
  const terminal = core.layout.getLayout().regions.bottom.widgets[0]!;
  core.movePanel(terminal.widgetId, "side");
  core.closePlacement(core.layout.getLayout().regions.side.widgets[0]!.placementIdentity!);
  await core.dispose();
  const restored = setup(saved);
  await open(restored);
  for (let i = 0; i < 2; i++) {
    await restored.commands.executeCommand("workbench.resetPageLayout");
    expect(restored.layout.getLayout().regions.bottom.widgets).toEqual([
      expect.objectContaining({ widgetId: terminal.widgetId, resource: resource("original-terminal") }),
    ]);
    expect(tabs(restored).filter((t) => t.resource?.id === "original-terminal")).toHaveLength(1);
  }
  await restored.dispose();
});

test("reset creates a replacement only when the preset resource is unavailable", async () => {
  const core = setup(new Map(), true);
  let created = 0;
  core.commands.registerCommand(
    { id: "new-terminal", label: "New terminal" },
    {
      execute: async () => {
        created++;
        await core.navigation.openTarget({
          kind: "panel",
          panel: { kind: "page-slot", page: page("tools"), id: "terminal" },
          resource: resource(`replacement-${created}`),
        });
      },
    },
  );
  await open(core);
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "page-slot", page: page("tools"), id: "terminal" },
    resource: resource("expired"),
  });
  core.closePlacement(core.layout.getLayout().regions.bottom.widgets[0]!.placementIdentity!);
  core.resources.removed(resource("expired"));
  await core.resetPageLayout();
  expect(created).toBe(1);
  expect(core.layout.getLayout().regions.bottom.widgets[0]?.resource?.id).toBe("replacement-1");
  await core.resetPageLayout();
  expect(created).toBe(1);
  await core.dispose();
});

test("mode reset preserves a moved preset with its page owner exactly once", async () => {
  const core = setup();
  await open(core);
  const player = core.layout.getLayout().regions.secondary.widgets[0]!;
  core.movePanel(player.widgetId, "aside");
  await core.resetModeLayout();
  expect(core.layout.getLayout().regions.aside.widgets.map((t) => t.widgetId)).toContain(player.widgetId);
  expect(core.layout.getLayout().regions.secondary.widgets).toEqual([]);
  expect(tabs(core).filter((t) => t.widgetId === player.widgetId)).toHaveLength(1);
  await core.dispose();
});

test("repeated reset joins pending preset creation for the same owner", async () => {
  const core = setup(new Map(), true);
  let created = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  core.commands.registerCommand(
    { id: "new-terminal", label: "New terminal" },
    {
      execute: async () => {
        created++;
        await ready;
        await core.navigation.openTarget({
          kind: "panel",
          panel: { kind: "page-slot", page: page("tools"), id: "terminal" },
          resource: resource(`replacement-${created}`),
        });
      },
    },
  );
  await open(core);
  const first = core.resetPageLayout();
  const second = core.resetPageLayout();
  const before = created;
  release();
  await Promise.all([first, second]);
  await core.dispose();
  expect(before).toBe(1);
});

test("a closed preset whose binding rule changes is corrected on reload without throwing", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const core = setup(saved);
  await open(core);
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "page-slot", page: page("tools"), id: "terminal" },
    resource: resource("original"),
  });
  core.closePlacement(core.layout.getLayout().regions.bottom.widgets[0]!.placementIdentity!);
  await core.dispose();
  const restored = setup(saved, false, "workspace");
  await open(restored);
  await restored.resetPageLayout();
  expect(restored.layout.getLayout().regions.bottom.widgets).toEqual([]);
  await restored.dispose();
});

test("removing a closed preset resource prevents reset from reviving it after reload", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const core = setup(saved);
  await open(core);
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "page-slot", page: page("tools"), id: "terminal" },
    resource: resource("deleted"),
  });
  core.closePlacement(core.layout.getLayout().regions.bottom.widgets[0]!.placementIdentity!);
  core.resources.removed(resource("deleted"));
  await core.dispose();
  const restored = setup(saved);
  await open(restored);
  await restored.resetPageLayout();
  expect(restored.layout.getLayout().regions.bottom.widgets).toEqual([]);
  await restored.dispose();
});
