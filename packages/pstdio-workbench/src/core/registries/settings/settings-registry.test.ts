import { describe, expect, test } from "bun:test";
import { createSettingsRegistry } from "./settings-registry";

describe("settings registry — sections", () => {
  test("registers, orders, and disposes sections", () => {
    const registry = createSettingsRegistry();
    registry.registerSection({ id: "extensions", title: "Extensions", order: 20 });
    const workbench = registry.registerSection({ id: "workbench", title: "Workbench", order: 10 });
    registry.registerSection({ id: "danger", order: 30 }); // headerless

    expect(registry.getSection("workbench")?.title).toBe("Workbench");
    expect(registry.listSections().map((section) => section.id)).toEqual(["workbench", "extensions", "danger"]);

    workbench.dispose();
    expect(registry.getSection("workbench")).toBeUndefined();
  });

  test("rejects duplicate section ids", () => {
    const registry = createSettingsRegistry();
    registry.registerSection({ id: "workbench" });
    expect(() => registry.registerSection({ id: "workbench" })).toThrow(/already registered/i);
  });
});

describe("settings registry — panels", () => {
  test("registers schema, View, and collection panels and resolves collection items", async () => {
    const registry = createSettingsRegistry({ hasView: () => true });

    registry.registerPanel({
      kind: "schema",
      id: "appearance",
      title: "Appearance",
      section: "workbench",
      scope: "global",
      preferences: ["app.theme", { name: "app.density", label: "Density" }],
      save: "apply",
    });
    registry.registerPanel({ kind: "view", id: "about", title: "About", scope: "global", viewId: "about.view" });
    registry.registerPanel({
      kind: "collection",
      id: "widgets",
      title: "Widgets",
      section: "project",
      scope: "project",
      items: () => [{ id: "w1", name: "One" }],
      itemId: (item) => item.id,
      itemLabel: (item) => item.name,
      viewId: "widget.editor",
      actions: [{ id: "create", label: "Create widget", run: () => {} }],
    });

    const appearance = registry.getPanel("appearance");
    expect(appearance?.kind === "schema" && appearance.save).toBe("apply");
    expect(appearance?.scope).toBe("global");

    const widgets = registry.getPanel("widgets");
    expect(widgets?.kind).toBe("collection");
    expect(widgets?.kind === "collection" && widgets.viewId).toBe("widget.editor");
    expect(await registry.resolveCollectionItem("widgets", "w1")).toEqual({ id: "w1", name: "One" });
    expect(registry.getCollectionItem("widgets", "w1")).toEqual({ id: "w1", name: "One" });
    expect(widgets?.kind === "collection" && widgets.actions?.[0]?.label).toBe("Create widget");

    expect(registry.listPanels().map((panel) => panel.id)).toEqual(["appearance", "about", "widgets"]);
  });

  test("orders panels by explicit order then registration, and disposes", () => {
    const registry = createSettingsRegistry({ hasView: () => true });
    registry.registerPanel({ kind: "view", id: "b", title: "B", order: 20, viewId: "b.view" });
    const a = registry.registerPanel({ kind: "view", id: "a", title: "A", order: 10, viewId: "a.view" });
    registry.registerPanel({ kind: "view", id: "c", title: "C", viewId: "c.view" });

    expect(registry.listPanels().map((panel) => panel.id)).toEqual(["c", "a", "b"]);

    a.dispose();
    expect(registry.getPanel("a")).toBeUndefined();
    expect(() => registry.registerPanel({ kind: "view", id: "b", title: "Dup", viewId: "b.view" })).toThrow(
      /already registered/i,
    );
  });
});

describe("settings registry — refresh", () => {
  test("refresh bumps the store revision and notifies subscribers", () => {
    const registry = createSettingsRegistry();
    let notifications = 0;
    const unsubscribe = registry.store.subscribe(() => {
      notifications += 1;
    });

    const before = registry.store.getState().revision;
    registry.refresh();
    expect(registry.store.getState().revision).toBe(before + 1);
    expect(notifications).toBe(1);

    unsubscribe();
  });
});
