import { describe, expect, test } from "bun:test";
import type { PlacementItem } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";

describe("placement add command availability", () => {
  test.each(["shell", "mode", "page"] as const)("%s bindings only offer available add commands", (owner) => {
    const workbench = createWorkbench();
    let enabled = true;
    let visible = true;
    const args = { kind: "guide" };
    workbench.commands.registerCommand(
      { id: "open-guide", label: "Open guide", when: "guidesAvailable" },
      {
        execute: () => undefined,
        isEnabled: (input) => enabled && input === args,
        isVisible: (input) => visible && input === args,
      },
    );
    workbench.context.set("guidesAvailable", true);
    workbench.views.registerView({ id: "guide", title: "Guide", body: { kind: "react", render: () => null } });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    const item: PlacementItem = {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "guide" }],
        view: { kind: "view", id: "guide" },
        cardinality: "many",
        add: { kind: "command", target: { command: { kind: "command", id: "open-guide" }, params: args } },
      },
    };
    const placement = { id: "guide", region: "side" as const, item };
    if (owner === "shell") workbench.shellPlacements.registerPlacement(placement);
    if (owner === "mode") {
      workbench.modePlacements.registerPlacement({
        ...placement,
        ref: { extensionId: "test", kind: "placement", id: "guide" },
        modeId: "project",
      });
    }
    const page = { extensionId: "test", kind: "page" as const, id: "start" };
    workbench.pages.registerPage({
      id: "start",
      ref: page,
      path: "",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "guide" }, cardinality: "one" },
      slots: owner === "page" ? [placement] : [],
    });
    workbench.pageLocations.setProject("storybook");
    workbench.pageLocations.navigate({ kind: "page", page });
    const addable = () => workbench.composition.panelsFor("side").addable;
    expect(addable()).toHaveLength(1);
    enabled = false;
    expect(addable()).toHaveLength(0);
    enabled = true;
    visible = false;
    expect(addable()).toHaveLength(0);
    visible = true;
    workbench.context.set("guidesAvailable", false);
    expect(addable()).toHaveLength(0);
    workbench.context.set("guidesAvailable", true);
    expect(addable()).toHaveLength(1);
  });
});

const editorFixture = (owner: "shell" | "mode" | "page") => {
  const w = createWorkbench({ initialSidePanelMode: "closed" });
  const page = { kind: "page", extensionId: "test", id: "notes" } as const;
  const home = { ...page, id: "home" };
  const resource = { type: "note", id: "one", extensionId: "test", projectId: "project" };
  const placement = {
    id: "note",
    region: "side" as const,
    item: {
      kind: "binding" as const,
      binding: {
        kinds: [{ kind: "resource-kind" as const, id: "note" }],
        view: { kind: "view" as const, id: "note" },
        cardinality: "many" as const,
      },
    },
  };
  w.views.registerView({ id: "home", title: "Home", body: { kind: "react", render: () => null } });
  w.views.registerView({
    id: "note",
    title: "Note",
    instancePolicy: "per-resource",
    body: { kind: "react", render: () => null },
  });
  w.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  if (owner === "shell") w.shellPlacements.registerPlacement(placement);
  if (owner === "mode")
    w.modePlacements.registerPlacement({
      ...placement,
      ref: { kind: "placement", extensionId: "test", id: "note" },
      modeId: "project",
    });
  w.pages.registerPage({
    id: "home",
    ref: home,
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one" },
    slots: [],
  });
  w.pages.registerPage({
    id: "notes",
    ref: page,
    path: "notes",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
    main: { kind: "view", view: { kind: "view", id: "note" }, cardinality: "many" },
    slots: owner === "page" ? [placement] : [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page, resource, open: "pin" });
  return { w, home, page, resource };
};

describe("adding an already open resource editor", () => {
  test.each([
    "shell",
    "mode",
    "page",
  ] as const)("%s additions open a new resource in the chosen tray", async (owner) => {
    const s = editorFixture(owner);
    const resource = { ...s.resource, id: "two" };
    const add = s.w.composition.panelsFor("secondary").addable[0]!;
    await add.open!(resource);
    expect(s.w.notifications.listNotifications()).toEqual([]);
    expect(s.w.layout.getActivePanel("secondary")).toMatchObject({ resource, tabRetention: "persistent" });
    expect(s.w.layout.getActivePanel("main")?.resource).toEqual(s.resource);
  });

  test.each([
    "shell",
    "mode",
    "page",
  ] as const)("%s additions select its existing tray without an error", async (owner) => {
    const s = editorFixture(owner);
    const original = s.w.layout.getActivePanel("main")!;
    const add = s.w.composition.panelsFor("secondary").addable[0]!;
    await add.open!(s.resource);
    expect(s.w.notifications.listNotifications()).toEqual([]);
    expect(s.w.layout.getActivePanel()?.instanceId).toBe(original.instanceId);
    expect(s.w.layout.listPanelInstances("secondary")).toEqual([]);
    expect(s.w.layout.listPanelInstances().filter((p) => p.viewId === "note")).toHaveLength(1);
  });

  test.each(["shell", "mode", "page"] as const)("%s additions restore a hidden Main editor", async (owner) => {
    const s = editorFixture(owner);
    const original = s.w.layout.getActivePanel("main")!;
    const add = s.w.composition.panelsFor("side").addable[0]!;
    if (owner === "page")
      s.w.pageLocations.navigate({ kind: "page", page: s.page, resource: { ...s.resource, id: "two" } });
    else s.w.pageLocations.navigate({ kind: "page", page: s.home });
    await add.open!(s.resource);
    expect(s.w.notifications.listNotifications()).toEqual([]);
    expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
    expect(s.w.layout.listPanelInstances("side")).toEqual([]);
  });
});
