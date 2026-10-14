import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { closedDeclaredTools } from "./declared-tools";

const home = { kind: "page" as const, extensionId: "test", id: "home" };
const setup = () => {
  const core = createWorkbench();
  core.modes.registerMode({ id: "mode", regionSettings: { secondary: { acceptsTabs: false } }, activate() {} });
  for (const id of ["proposal", "player", "inspector"])
    core.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  core.pages.registerPage({
    id: "home",
    ref: home,
    path: "home",
    modeId: "mode",
    main: { kind: "view", view: { kind: "view", id: "proposal" }, cardinality: "one" },
    slots: [
      {
        id: "inspector",
        region: "aside",
        item: { kind: "view", view: { kind: "view", id: "inspector" }, presence: "closed" },
      },
    ],
  });
  core.modePlacements.registerPlacement({
    id: "player",
    ref: { kind: "placement", extensionId: "test", id: "player" },
    modeId: "mode",
    region: "secondary",
    movableTo: ["secondary"],
    item: { kind: "view", view: { kind: "view", id: "player" }, presence: "fixed" },
  });
  core.pageLocations.setProject("project");
  core.pageLocations.navigate({ kind: "page", page: home });
  return core;
};

test("closing a page Main leaves the page empty and its declaration reopens it", async () => {
  const core = setup();
  try {
    const tab = core.layout.getLayout().regions.main.widgets[0]!;
    expect(tab.closable).toBe(true);
    core.closePlacement(tab.placementIdentity!);
    expect(core.pages.store.getState().activePageId).toBe("home");
    expect(core.layout.getLayout().regions.main.widgets).toEqual([]);
    expect(
      closedDeclaredTools(core.composition.panelsFor("main"), "main").map((tool) => tool.contribution.title),
    ).toEqual(["proposal"]);
    expect(core.pageLocations.navigate({ kind: "page", page: home }).ok).toBe(true);
    expect(core.layout.getLayout().regions.main.widgets).toEqual([]);
    const proposal = core.composition.panelsFor("main").addable.find((p) => p.contribution.title === "proposal");
    expect(proposal).toBeDefined();
    await proposal!.open?.();
    expect(core.layout.getLayout().regions.main.widgets).toHaveLength(1);
  } finally {
    await core.dispose();
  }
});

test("declared tools reopen in their panel even when it refuses incoming tabs", async () => {
  const core = setup();
  try {
    const player = core.layout.getLayout().regions.secondary.widgets[0]!;
    expect(player.closable).toBe(true);
    core.closePlacement(player.placementIdentity!);
    const catalog = core.composition.panelsFor("secondary").addable;
    expect(
      closedDeclaredTools(core.composition.panelsFor("secondary"), "secondary").map((tool) => tool.contribution.title),
    ).toEqual(["player"]);
    expect(catalog.map((p) => p.contribution.title)).toEqual(["player"]);
    await catalog[0]!.open?.();
    expect(core.layout.getLayout().regions.secondary.widgets).toHaveLength(1);
    expect(core.composition.panelsFor("aside").addable.map((p) => p.contribution.title)).toContain("inspector");
    expect(core.composition.panelsFor("main").addable.map((p) => p.contribution.title)).toContain("inspector");
    expect(
      closedDeclaredTools(core.composition.panelsFor("main"), "main").map((tool) => tool.contribution.title),
    ).not.toContain("inspector");
  } finally {
    await core.dispose();
  }
});

test("new host declarations ignore tab locks and focus a tool moved away from its declared panel", async () => {
  const core = setup();
  try {
    const player = core.layout.getLayout().regions.secondary.widgets[0]!;
    core.movePanel(player.widgetId, "aside");
    const catalog = core.composition.panelsFor("secondary").addable;
    await catalog.find((p) => p.panelId === player.contributionId)!.open?.();
    expect(core.layout.getLayout().activeWidgetId).toBe(player.widgetId);
    expect(core.layout.getLayout().regions.secondary.widgets).toEqual([]);
    expect(core.layout.getLayout().regions.aside.widgets.filter((p) => p.widgetId === player.widgetId)).toHaveLength(1);
  } finally {
    await core.dispose();
  }
});

test("a closed resource Main reopens with its route binding and preserves closed companion tools", async () => {
  const core = setup();
  const page = { ...home, id: "proposal" };
  const resource = { type: "proposal", id: "one" };
  core.pages.registerPage({
    id: "proposal",
    ref: page,
    path: "proposal",
    modeId: "mode",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "proposal" }] },
    main: { kind: "view", view: { kind: "view", id: "proposal" }, cardinality: "one" },
    slots: [
      {
        id: "reader",
        region: "aside",
        openOn: "page-resource",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "proposal" }],
            view: { kind: "view", id: "inspector" },
            cardinality: "one",
          },
        },
      },
    ],
  });
  try {
    expect(core.pageLocations.navigate({ kind: "page", page, resource }).ok).toBe(true);
    core.closePlacement(core.layout.getLayout().regions.aside.widgets[0]!.placementIdentity!);
    core.closePlacement(core.layout.getLayout().regions.main.widgets[0]!.placementIdentity!);
    expect(core.layout.getLayout().regions.aside.widgets).toEqual([]);
    expect(core.getPrimaryResource()).toMatchObject(resource);
    const main = core.composition.panelsFor("main").addable.find((tool) => tool.contribution.title === "proposal")!;
    await main.open?.(core.getPrimaryResource());
    expect(core.layout.getLayout().regions.main.widgets[0]).toMatchObject({ resource });
    expect(core.layout.getLayout().regions.aside.widgets).toEqual([]);
  } finally {
    await core.dispose();
  }
});

test("a declared binding add command opens in its own refusing panel without a failed move", async () => {
  const core = setup();
  const ref = { kind: "placement" as const, extensionId: "test", id: "feed" };
  const resource = { type: "feed", id: "one" };
  core.commands.registerCommand(
    { id: "create-feed", label: "Create feed" },
    {
      execute: () => core.navigation.openTarget({ kind: "panel", panel: ref, resource }),
    },
  );
  core.modePlacements.registerPlacement({
    id: "feed",
    ref,
    modeId: "mode",
    region: "secondary",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "feed" }],
        view: { kind: "view", id: "player" },
        cardinality: "one",
        add: { kind: "command", target: { command: { kind: "command", id: "create-feed" } } },
      },
    },
  });
  try {
    await core.composition
      .panelsFor("secondary")
      .addable.find((tool) => tool.panelId.endsWith("feed"))!
      .open?.();
    expect(
      core.layout.getLayout().regions.secondary.widgets.filter((tab) => tab.resource?.id === resource.id),
    ).toHaveLength(1);
    expect(core.notifications.listNotifications()).toEqual([]);
  } finally {
    await core.dispose();
  }
});
