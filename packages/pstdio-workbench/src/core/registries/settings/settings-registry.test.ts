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
  test("registers schema, custom, and collection panels and preserves their shape", () => {
    const registry = createSettingsRegistry();

    registry.registerPanel({
      kind: "schema",
      id: "appearance",
      title: "Appearance",
      section: "workbench",
      scope: "global",
      preferences: ["app.theme", { name: "app.density", label: "Density" }],
      save: "apply",
    });
    registry.registerPanel({ kind: "custom", id: "about", title: "About", scope: "global", render: () => "about" });
    registry.registerPanel({
      kind: "collection",
      id: "widgets",
      title: "Widgets",
      section: "project",
      scope: "project",
      items: () => [{ id: "w1", name: "One" }],
      itemId: (item) => item.id,
      itemLabel: (item) => item.name,
      renderItem: (item) => `editor:${item.id}`,
      actions: [{ id: "create", label: "Create widget", run: () => {} }],
    });

    const appearance = registry.getPanel("appearance");
    expect(appearance?.kind === "schema" && appearance.save).toBe("apply");
    expect(appearance?.scope).toBe("global");

    const widgets = registry.getPanel("widgets");
    expect(widgets?.kind).toBe("collection");
    expect(widgets?.kind === "collection" && widgets.renderItem({ id: "w1" }, {} as never)).toBe("editor:w1");
    expect(widgets?.kind === "collection" && widgets.actions?.[0]?.label).toBe("Create widget");

    expect(registry.listPanels().map((panel) => panel.id)).toEqual(["appearance", "about", "widgets"]);
  });

  test("orders panels by explicit order then registration, and disposes", () => {
    const registry = createSettingsRegistry();
    registry.registerPanel({ kind: "custom", id: "b", title: "B", order: 20, render: () => null });
    const a = registry.registerPanel({ kind: "custom", id: "a", title: "A", order: 10, render: () => null });
    registry.registerPanel({ kind: "custom", id: "c", title: "C", render: () => null });

    expect(registry.listPanels().map((panel) => panel.id)).toEqual(["c", "a", "b"]);

    a.dispose();
    expect(registry.getPanel("a")).toBeUndefined();
    expect(() => registry.registerPanel({ kind: "custom", id: "b", title: "Dup", render: () => null })).toThrow(
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
