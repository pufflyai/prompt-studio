import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const panel = { kind: "placement", extensionId: "test", id: "default" } as const;
const page = { kind: "page", extensionId: "test", id: "page" } as const;
const registerOwner = (core: ReturnType<typeof createWorkbench>) => {
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  core.modePlacements.registerPlacement({
    id: "default",
    ref: panel,
    modeId: "mode",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "view" }, presence: "closed" },
  });
  core.pages.registerPage({
    id: "page",
    ref: page,
    path: "page",
    modeId: "mode",
    main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
    slots: [],
  });
  core.pageLocations.setProject("project");
  return core.navigation.openTarget({ kind: "page", page });
};

test("a newer Close survives the completion of a pending default that opens a real tab", async () => {
  const core = createWorkbench({ initialSidePanelMode: "closed" });
  let finish = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  core.commands.registerCommand(
    { id: "create", label: "Create" },
    {
      execute: async () => {
        await gate;
        await core.navigation.openTarget({ kind: "panel", panel });
      },
    },
  );
  core.modes.registerMode({
    id: "mode",
    regionSettings: { side: { defaultTab: { kind: "command", commandId: "create" } } },
    activate() {},
  });
  await registerOwner(core);
  const opening = core.shell.setRegionOpen("side", true);
  core.shell.setRegionOpen("side", false);
  finish();
  await opening;
  expect(core.layout.listPanelInstances("side")).toHaveLength(1);
  expect(core.layout.getLayout().regions.side.visibility).toBe("closed");
  expect(core.shell.getRegionState("side").open).toBe(false);
  await core.dispose();
});

for (const kind of ["command", "panel"] as const) {
  for (const regionDefault of [false, true]) {
    test(`floating ${kind} default rejects tab admission before mutation with region default ${regionDefault}`, async () => {
      const core = createWorkbench({ initialSidePanelMode: "closed" });
      let created = 0;
      core.layout.registerPanel({
        id: "created",
        title: "Created",
        region: "side",
        rendererId: "created",
        closable: true,
      });
      core.commands.registerCommand(
        { id: "create", label: "Create" },
        {
          execute() {
            created++;
            core.layout.openPanel("created");
          },
        },
      );
      const floatingDefault =
        kind === "command" ? { kind: "command" as const, commandId: "create" } : { kind: "panel" as const, panel };
      core.modes.registerMode({
        id: "mode",
        regionSettings: {
          side: {
            acceptsTabs: false,
            defaultTab: regionDefault ? { kind: "command", commandId: "create" } : undefined,
          },
        },
        floating: { defaultTab: floatingDefault },
        activate() {},
      });
      await registerOwner(core);
      const before = core.layout.getLayout();
      expect(() => core.shell.setSidePanelPresentation("floating")).toThrow("cannot accept tabs");
      expect(core.layout.getLayout()).toBe(before);
      expect(created).toBe(0);
      expect(core.layout.listPanelInstances("side")).toHaveLength(0);
      await core.dispose();
    });
  }
}

test("a Close after default navigation survives remaining creation work", async () => {
  const core = createWorkbench();
  let created = () => {};
  const navigated = new Promise<void>((resolve) => {
    created = resolve;
  });
  let finish = () => {};
  const remaining = new Promise<void>((resolve) => {
    finish = resolve;
  });
  core.commands.registerCommand(
    { id: "create", label: "Create" },
    {
      execute: async () => {
        await core.navigation.openTarget({ kind: "panel", panel });
        created();
        await remaining;
      },
    },
  );
  core.modes.registerMode({
    id: "mode",
    regionSettings: { side: { defaultTab: { kind: "command", commandId: "create" } } },
    activate() {},
  });
  await registerOwner(core);
  const opening = core.shell.setRegionOpen("side", true);
  await navigated;
  core.shell.setRegionOpen("side", false);
  expect(core.shell.getRegionState("side").open).toBe(false);
  finish();
  await opening;
  expect(core.shell.getRegionState("side").open).toBe(false);
  expect(core.layout.listPanelInstances("side")).toHaveLength(1);
  await core.dispose();
});

test("floating defaults override the region default on an admitted empty open", async () => {
  const core = createWorkbench();
  let regionCreated = 0;
  let floatingCreated = 0;
  core.commands.registerCommand(
    { id: "region", label: "Region" },
    {
      execute() {
        regionCreated++;
      },
    },
  );
  core.commands.registerCommand(
    { id: "floating", label: "Floating" },
    {
      execute() {
        floatingCreated++;
      },
    },
  );
  core.modes.registerMode({
    id: "mode",
    regionSettings: { side: { defaultTab: { kind: "command", commandId: "region" } } },
    floating: { defaultTab: { kind: "command", commandId: "floating" } },
    activate() {},
  });
  await registerOwner(core);
  await core.shell.setSidePanelPresentation("floating");
  expect(regionCreated).toBe(0);
  expect(floatingCreated).toBe(1);
  await core.dispose();
});

test("a Close before late default navigation stays closed while creation is pending", async () => {
  const core = createWorkbench();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let created = () => {};
  const navigated = new Promise<void>((resolve) => {
    created = resolve;
  });
  let finish = () => {};
  const remaining = new Promise<void>((resolve) => {
    finish = resolve;
  });
  core.commands.registerCommand(
    { id: "create", label: "Create" },
    {
      execute: async () => {
        await gate;
        await core.navigation.openTarget({ kind: "panel", panel });
        created();
        await remaining;
      },
    },
  );
  core.modes.registerMode({
    id: "mode",
    regionSettings: { side: { defaultTab: { kind: "command", commandId: "create" } } },
    activate() {},
  });
  await registerOwner(core);
  const opening = core.shell.setRegionOpen("side", true);
  core.shell.setRegionOpen("side", false);
  release();
  await navigated;
  expect(core.layout.listPanelInstances("side")).toHaveLength(1);
  expect(core.shell.getRegionState("side").open).toBe(false);
  expect(core.layout.getLayout().regions.side.visibility).toBe("closed");
  finish();
  await opening;
  expect(core.shell.getRegionState("side").open).toBe(false);
  await core.dispose();
});

test("a synchronous default command Close is the latest accepted choice", async () => {
  const core = createWorkbench();
  core.commands.registerCommand(
    { id: "create", label: "Create" },
    {
      execute: async () => {
        core.shell.setRegionOpen("side", false);
        await core.navigation.openTarget({ kind: "panel", panel });
      },
    },
  );
  core.modes.registerMode({
    id: "mode",
    regionSettings: { side: { defaultTab: { kind: "command", commandId: "create" } } },
    activate() {},
  });
  await registerOwner(core);
  await core.shell.setRegionOpen("side", true);
  expect(core.layout.listPanelInstances("side")).toHaveLength(1);
  expect(core.shell.getRegionState("side").open).toBe(false);
  await core.dispose();
});
