import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";

const createLayoutWithPanels = () => {
  const layout = createLayoutModel();
  layout.registerPanel({
    id: "app.session",
    title: "Session",
    region: "side",
    rendererId: "session.renderer",
  });
  layout.registerPanel({
    id: "app.nav",
    title: "Navigation",
    region: "sidenav",
    rendererId: "nav.renderer",
  });
  return layout;
};

const resource = (id: string) => ({ kind: "session" as const, uri: `app://session/${id}`, id, label: `Session ${id}` });

const retentionOf = (layout: ReturnType<typeof createLayoutModel>, region: "side" | "sidenav", widgetId: string) =>
  layout.getLayout().regions[region].widgets.find((placement) => placement.widgetId === widgetId)?.tabRetention;

describe("openPanel tab retention", () => {
  test("opens a preview tab when no strategy is given", () => {
    const layout = createLayoutWithPanels();

    const instance = layout.openPanel("app.session", { resource: resource("a") });

    expect(retentionOf(layout, "side", instance.instanceId)).toBe("preview");
  });

  test("opens a persistent tab when the caller asks for one", () => {
    const layout = createLayoutWithPanels();

    const instance = layout.openPanel("app.session", { resource: resource("a"), strategy: { kind: "persistent" } });

    expect(retentionOf(layout, "side", instance.instanceId)).toBe("persistent");
  });

  test("keeps chrome outside tab-hosting regions persistent", () => {
    const layout = createLayoutWithPanels();

    const instance = layout.openPanel("app.nav");

    expect(retentionOf(layout, "sidenav", instance.instanceId)).toBe("persistent");
  });

  test("keeps a pinned panel persistent", () => {
    const layout = createLayoutWithPanels();

    const instance = layout.openPanel("app.session", { pinned: true });

    expect(retentionOf(layout, "side", instance.instanceId)).toBe("persistent");
  });

  test("leaves tab retention untouched when updating a panel", () => {
    const layout = createLayoutWithPanels();
    const instance = layout.openPanel("app.session", { resource: resource("a") });

    layout.updatePanel(instance.instanceId, { title: "Renamed" });

    expect(retentionOf(layout, "side", instance.instanceId)).toBe("preview");
  });

  test("promotes a preview tab to persistent when the user keeps it open", () => {
    const layout = createLayoutWithPanels();
    const instance = layout.openPanel("app.session", { resource: resource("a") });

    layout.updatePanel(instance.instanceId, { strategy: { kind: "persistent" } });

    expect(retentionOf(layout, "side", instance.instanceId)).toBe("persistent");
  });

  test("can replace a persistent panel as a preview", () => {
    const layout = createLayoutWithPanels();
    const instance = layout.openPanel("app.session", {
      resource: resource("a"),
      strategy: { kind: "persistent" },
    });

    const replacement = layout.openPanel("app.session", {
      resource: resource("b"),
      strategy: { kind: "replace-panel", instanceId: instance.instanceId, retention: "preview" },
    });

    expect(replacement.instanceId).toBe(instance.instanceId);
    expect(replacement.resourceUri).toBe(resource("b").uri);
    expect(retentionOf(layout, "side", instance.instanceId)).toBe("preview");
  });
});
