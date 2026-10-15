import { expect, test } from "bun:test";
import { harness, page, panel, resource } from "./placement-lifecycle-test-support";

test.each([
  false,
  true,
])("page reset keeps its initiating owner when the next workspace has a preset: %s", async (betaHasPreset) => {
  const core = harness();
  const ref = page("tools");
  core.pages.registerPage({
    id: "tools",
    ref,
    path: "tools",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "terminal",
        region: "bottom",
        item: {
          kind: "binding",
          binding: {
            view: { kind: "view", id: "editor" },
            kinds: [{ kind: "resource-kind", id: "file" }],
            cardinality: "one",
            add: { kind: "command", target: { command: { kind: "command", id: "create-terminal" } } },
          },
        },
      },
    ],
  });
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const starting = new Promise<void>((resolve) => {
    started = resolve;
  });
  core.commands.registerCommand(
    { id: "create-terminal", label: "Create terminal" },
    {
      execute: async (_args, context) => {
        const workspace = core.getPrimaryResource()!.id;
        const navigation = context?.navigation ?? core.navigation;
        started();
        await ready;
        await navigation.openTarget({
          kind: "panel",
          panel: { kind: "page-slot", page: ref, id: "terminal" },
          resource: resource(`terminal-${workspace}`),
        });
      },
    },
  );
  const visit = (id: string) =>
    core.navigation.openTarget({ kind: "page", page: ref, resource: { type: "workspace", id } });
  try {
    await visit("alpha");
    const reset = core.resetPageLayout();
    await starting;
    await visit("beta");
    if (betaHasPreset)
      await core.navigation.openTarget({
        kind: "panel",
        panel: { kind: "page-slot", page: ref, id: "terminal" },
        resource: resource("terminal-beta"),
      });
    await core.navigation.openPanel({ panel, resource: resource("beta-side") });
    core.focus.setActiveRegion("sidenav");
    const before = core.layout.getLayout();
    let focusRequests = 0;
    const subscription = core.focus.onDidRequestPanelFocus(() => {
      focusRequests++;
    });
    release();
    await reset;
    subscription.dispose();
    expect({ activeRegion: core.focus.getActiveRegion(), focusRequests }).toEqual({
      activeRegion: "sidenav",
      focusRequests: 0,
    });
    expect(core.layout.getLayout().activeWidgetId).toBe(before.activeWidgetId);
    const activeAfterCompletion = core.pages.store.getState().location?.resource?.id;
    const betaTabs = core.layout.getLayout().regions.bottom.widgets.map((tab) => tab.resource?.id);
    expect(core.layout.getLayout().regions.bottom.widgets.map((tab) => tab.widgetId)).toEqual(
      before.regions.bottom.widgets.map((tab) => tab.widgetId),
    );
    await visit("alpha");
    const alphaTabs = core.layout.getLayout().regions.bottom.widgets.map((tab) => tab.resource?.id);
    expect({ activeAfterCompletion, betaTabs, alphaTabs }).toEqual({
      activeAfterCompletion: "beta",
      betaTabs: betaHasPreset ? ["terminal-beta"] : [],
      alphaTabs: ["terminal-alpha"],
    });
  } finally {
    release();
    await core.dispose();
  }
});

test("mode reset publishes its pending preset to the initiating mode without changing the current page", async () => {
  const core = harness();
  const terminal = { kind: "placement" as const, extensionId: "test", id: "terminal" };
  core.modes.registerMode({ id: "review", activate() {} });
  core.pages.registerPage({
    id: "review",
    ref: page("review"),
    path: "review",
    modeId: "review",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  core.modePlacements.registerPlacement({
    id: "terminal",
    ref: terminal,
    modeId: "edit",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "editor" },
        kinds: [{ kind: "resource-kind", id: "file" }],
        cardinality: "one",
        add: { kind: "command", target: { command: { kind: "command", id: "create-terminal" } } },
      },
    },
  });
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const starting = new Promise<void>((resolve) => {
    started = resolve;
  });
  core.commands.registerCommand(
    { id: "create-terminal", label: "Create terminal" },
    {
      execute: async (_args, context) => {
        started();
        await ready;
        await context!.navigation!.openPanel({ panel: terminal, resource: resource("terminal-alpha") });
      },
    },
  );
  try {
    await core.navigation.openPage({ page: page("workspace"), resource: { type: "workspace", id: "alpha" } });
    const reset = core.resetModeLayout();
    await starting;
    await core.navigation.openPage({ page: page("review") });
    release();
    await reset;
    expect(core.pages.store.getState().activePageId).toBe("review");
    expect(core.layout.getLayout().regions.side.widgets).toEqual([]);
    await core.navigation.openPage({ page: page("workspace"), resource: { type: "workspace", id: "alpha" } });
    expect(core.layout.getLayout().regions.side.widgets.map((tab) => tab.resource?.id)).toEqual(["terminal-alpha"]);
  } finally {
    release();
    await core.dispose();
  }
});
