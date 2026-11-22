import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { readMenuHeaderSettings } from "./menu-header-settings";

test("menu header presentation persists by project and view", async () => {
  const w = createWorkbench();
  w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  w.pageLocations.setProject("one");
  await w.commands.executeCommand("workbench.configureMenuHeader", {
    viewId: "editor",
    position: "right",
    order: ["menu:files", "contribution"],
    multipleMenus: true,
  });
  expect(readMenuHeaderSettings(w, "editor")).toMatchObject({
    position: "right",
    order: ["menu:files", "contribution"],
    multipleMenus: true,
  });
  w.pageLocations.setProject("two");
  expect(readMenuHeaderSettings(w, "editor")).toMatchObject({ position: "top", multipleMenus: false });
  w.pageLocations.setProject("one");
  expect(readMenuHeaderSettings(w, "editor").position).toBe("right");
});

test("invalid menu header placement preserves the previous preference", async () => {
  const w = createWorkbench();
  w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  await expect(
    w.commands.executeCommand("workbench.configureMenuHeader", { viewId: "editor", position: "center" }),
  ).rejects.toThrow();
  expect(readMenuHeaderSettings(w, "editor").position).toBe("top");
});

test("a menu edge preference applies to existing and future resource instances", async () => {
  const w = createWorkbench();
  for (const id of ["editor", "properties"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.viewMenus.registerViewMenu({ id: "properties-menu", ownerViewId: "editor", viewId: "properties", side: "right" });
  w.layout.registerPanel({
    id: "documents",
    title: "Documents",
    rendererId: "editor",
    region: "main",
    singleton: false,
    panelMenus: w.viewMenus.definitionsFor("editor", "documents"),
  });
  w.layout.openWidget("documents", { resource: { type: "document", id: "a" }, pinned: true });
  const original = w.layout.getLayout().regions["main-right-menu"].widgets[0]!.widgetId;
  await w.commands.executeCommand("workbench.configureMenuHeader", {
    viewId: "editor",
    menuSides: { "properties-menu": "left" },
  });
  expect(w.layout.getLayout().regions["main-left-menu"].widgets[0]?.widgetId).toBe(original);
  w.layout.openWidget("documents", { resource: { type: "document", id: "b" }, pinned: true });
  expect(w.layout.getLayout().regions["main-left-menu"].widgets.map((entry) => entry.resource?.id)).toEqual(["a", "b"]);
  expect(w.layout.getLayout().regions["main-right-menu"].widgets).toHaveLength(0);
});

test("concurrent async header updates preserve both changes", async () => {
  const values = new Map<string, import("../../registries/preferences/preference-registry").PreferenceValue>();
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const firstWrite = new Promise<void>((resolve) => {
    started = resolve;
  });
  const w = createWorkbench({
    preferencePersistence: {
      getValue: (name, scope) => values.get(JSON.stringify([name, scope])),
      setValue: async (name, value, scope) => {
        started();
        await gate;
        values.set(JSON.stringify([name, scope]), value);
      },
    },
  });
  w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  const left = w.commands.executeCommand("workbench.configureMenuHeader", { viewId: "editor", position: "left" });
  await firstWrite;
  const order = w.commands.executeCommand("workbench.configureMenuHeader", { viewId: "editor", order: ["b", "a"] });
  release();
  await Promise.all([left, order]);
  expect(readMenuHeaderSettings(w, "editor")).toMatchObject({ position: "left", order: ["b", "a"] });
});

test("moving every resource's menu edge preserves the selected resource and focus", async () => {
  const w = createWorkbench();
  for (const id of ["editor", "properties"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.viewMenus.registerViewMenu({ id: "properties-menu", ownerViewId: "editor", viewId: "properties", side: "right" });
  w.layout.registerPanel({
    id: "documents",
    title: "Documents",
    rendererId: "editor",
    region: "main",
    singleton: false,
    panelMenus: w.viewMenus.definitionsFor("editor", "documents"),
  });
  const first = w.layout.openWidget("documents", {
    viewId: "editor",
    resource: { type: "document", id: "a" },
    pinned: true,
  });
  w.layout.openWidget("documents", { viewId: "editor", resource: { type: "document", id: "b" }, pinned: true });
  w.layout.activateWidget(first.widgetId);
  const before = w.layout.getLayout();
  await w.commands.executeCommand("workbench.configureMenuHeader", {
    viewId: "editor",
    menuSides: { "properties-menu": "left" },
  });
  expect(w.layout.getLayout().activeWidgetId).toBe(before.activeWidgetId);
  expect(w.layout.getLayout().activeResourceKey).toBe(before.activeResourceKey);
});

test("opening a closed menu on an occupied edge selects it without stealing the owner context", async () => {
  const { openOwnedViewMenu, selectViewMenuPlacement } = await import("./open-view-menu");
  const w = createWorkbench();
  for (const id of ["editor", "files", "properties"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  for (const id of ["files", "properties"])
    w.viewMenus.registerViewMenu({ id, ownerViewId: "editor", viewId: id, side: "left" });
  w.layout.registerPanel({
    id: "document",
    title: "Document",
    rendererId: "editor",
    region: "main",
    panelMenus: w.viewMenus.definitionsFor("editor", "document"),
  });
  const owner = w.layout.openWidget("document", { viewId: "editor", resource: { type: "document", id: "a" } });
  const [files, properties] = w.layout.getLayout().regions["main-left-menu"].widgets;
  w.layout.activateWidget(owner.widgetId);
  selectViewMenuPlacement(w, files!.widgetId);
  w.panelMenuState.setOpen(`panel-menu:${properties!.widgetId}`, false);
  openOwnedViewMenu(w, owner.widgetId, "properties");
  expect(w.panelMenuState.isOpen(`panel-menu:${properties!.widgetId}`)).toBe(true);
  expect(w.panelMenuState.isOpen(`panel-menu:${files!.widgetId}`)).toBe(false);
  expect(w.layout.getLayout().regions["main-left-menu"].activeWidgetId).toBe(properties!.widgetId);
  expect(w.layout.getLayout().activeWidgetId).toBe(owner.widgetId);
});

test("restored view aliases share canonical menu header preferences and policy", async () => {
  const { registerRegistryAliases } = await import("../../shared/contributions/identity-aliases");
  const w = createWorkbench();
  w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  const aliases = registerRegistryAliases(w.views.store, new Map([["old-editor", "editor"]]));
  try {
    w.viewMenus.configureOwner("editor", true);
    expect(readMenuHeaderSettings(w, "old-editor").multipleMenus).toBe(true);
    await w.commands.executeCommand("workbench.configureMenuHeader", { viewId: "old-editor", position: "left" });
    expect(readMenuHeaderSettings(w, "editor").position).toBe("left");
  } finally {
    aliases.dispose();
  }
});
