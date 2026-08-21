import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "../../core/registries/layout/layout-model";
import { createNotificationRegistry } from "../../core/registries/notifications/notification-registry";
import {
  compositionRequiredNotificationId,
  createWorkbenchCompositionRegistry,
  reconcileCompositionLayout,
} from "./composition-contributions";

const setupRegistry = () => {
  const registry = createWorkbenchCompositionRegistry();
  registry.registerResourceKind({
    id: "planner.ticket",
    extensionId: "pstdio.planner",
    surface: "primary",
    slots: {
      primary: { cardinality: "one", external: false },
      inspector: { cardinality: "many", external: true },
    },
  });
  registry.registerPanelCapability({
    id: "planner.editor",
    extensionId: "pstdio.planner",
    title: "Editor",
    show: { region: "main" },
  });
  registry.registerPanelCapability({
    id: "planner.properties",
    extensionId: "pstdio.planner",
    title: "Properties",
    show: { region: "side", allowedRegions: ["side", "secondary"] },
  });
  registry.registerResourcePanel({
    id: "planner.editor",
    extensionId: "pstdio.planner",
    resourceKind: "planner.ticket",
    panel: "planner.editor",
    slot: "primary",
  });
  registry.registerResourcePanel({
    id: "planner.properties",
    extensionId: "pstdio.planner",
    resourceKind: "planner.ticket",
    panel: "planner.properties",
    slot: "inspector",
  });
  registry.registerModeComposition({
    id: "planner.ticket-mode",
    resources: {
      "planner.ticket": {
        slots: {
          primary: { region: "main", required: true },
          inspector: { region: "side", allowedRegions: ["side", "secondary"] },
        },
      },
    },
  });
  return registry;
};

const setupWorkbench = () => {
  const snapshots = new Map<string | undefined, unknown>();
  const layout = createLayoutModel({
    persistence: {
      getLayout: (scope) => snapshots.get(scope) as ReturnType<typeof layout.getLayout> | undefined,
      setLayout: (snapshot, scope) => snapshots.set(scope, structuredClone(snapshot)),
    },
  });
  const notifications = createNotificationRegistry();
  layout.registerWidget({ id: "planner.editor", title: "Editor", region: "main", rendererId: "planner.editor" });
  layout.registerWidget({
    id: "planner.properties",
    title: "Properties",
    region: "side",
    rendererId: "planner.properties",
  });
  return { layout, notifications };
};

describe("composition reconciliation", () => {
  test("seeds a new scope from the recipe and enforces required closability", () => {
    const registry = setupRegistry();
    const ctx = setupWorkbench();

    reconcileCompositionLayout(ctx, {
      registry,
      modeId: "planner.ticket-mode",
      resourceKind: "planner.ticket",
      seeding: true,
    });

    const layout = ctx.layout.getLayout();
    expect(layout.regions.main.widgets.map((placement) => placement.contributionId)).toEqual(["planner.editor"]);
    expect(layout.regions.main.widgets[0]?.closable).toBe(false);
    expect(layout.regions.side.widgets.map((placement) => placement.contributionId)).toEqual(["planner.properties"]);
    expect(layout.regions.side.widgets[0]?.closable).toBe(true);
  });

  test("applies the recipe pinned policy instead of pinning every seeded panel", () => {
    const registry = setupRegistry();
    registry.registerModeComposition({
      id: "planner.pin-policy",
      resources: {
        "planner.ticket": {
          panels: {
            "planner.editor": { region: "main", required: true, pinned: true },
            "planner.properties": { region: "side", pinned: false },
          },
        },
      },
    });
    const ctx = setupWorkbench();

    reconcileCompositionLayout(ctx, {
      registry,
      modeId: "planner.pin-policy",
      resourceKind: "planner.ticket",
      seeding: true,
    });

    expect(ctx.layout.getLayout().regions.main.widgets[0]?.pinned).toBe(true);
    expect(ctx.layout.getLayout().regions.side.widgets[0]?.pinned).toBe(false);
  });

  test("restores a missing required placement without reopening a closed optional panel", () => {
    const registry = setupRegistry();
    const ctx = setupWorkbench();
    reconcileCompositionLayout(ctx, {
      registry,
      modeId: "planner.ticket-mode",
      resourceKind: "planner.ticket",
      seeding: true,
    });

    const seeded = ctx.layout.getLayout();
    const properties = seeded.regions.side.widgets[0];
    const editor = seeded.regions.main.widgets[0];
    if (properties) ctx.layout.closeWidget(properties.widgetId);
    if (editor) ctx.layout.removeWidgetPlacement(editor.widgetId);

    reconcileCompositionLayout(ctx, { registry, modeId: "planner.ticket-mode", resourceKind: "planner.ticket" });

    const layout = ctx.layout.getLayout();
    expect(layout.regions.main.widgets.map((placement) => placement.contributionId)).toEqual(["planner.editor"]);
    expect(layout.regions.side.widgets).toEqual([]);
  });

  test("keeps a valid user move and tab order through reconciliation", () => {
    const registry = setupRegistry();
    const ctx = setupWorkbench();
    reconcileCompositionLayout(ctx, {
      registry,
      modeId: "planner.ticket-mode",
      resourceKind: "planner.ticket",
      seeding: true,
    });

    const properties = ctx.layout.getLayout().regions.side.widgets[0];
    expect(properties).toBeDefined();
    if (!properties) return;
    ctx.layout.openWidget("planner.properties", { region: "secondary" });

    reconcileCompositionLayout(ctx, { registry, modeId: "planner.ticket-mode", resourceKind: "planner.ticket" });

    const layout = ctx.layout.getLayout();
    expect(layout.regions.secondary.widgets.map((placement) => placement.contributionId)).toEqual([
      "planner.properties",
    ]);
    expect(layout.regions.side.widgets).toEqual([]);
  });

  test("reports an unresolved required placement once with a stable notification id", () => {
    const registry = createWorkbenchCompositionRegistry();
    registry.registerResourceKind({
      id: "planner.ticket",
      extensionId: "pstdio.planner",
      surface: "primary",
      slots: { primary: { cardinality: "one", external: false } },
    });
    registry.registerPanelCapability({
      id: "planner.editor",
      extensionId: "pstdio.planner",
      title: "Editor",
      show: { resourceKind: "planner.ticket", region: "main" },
    });
    registry.registerModeComposition({
      id: "planner.ticket-mode",
      resources: {
        "planner.ticket": { panels: { "planner.editor": { region: "sidenav", required: true } } },
      },
    });
    const ctx = setupWorkbench();

    reconcileCompositionLayout(ctx, { registry, modeId: "planner.ticket-mode", resourceKind: "planner.ticket" });
    reconcileCompositionLayout(ctx, { registry, modeId: "planner.ticket-mode", resourceKind: "planner.ticket" });

    const notifications = ctx.notifications.listNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.id).toBe(compositionRequiredNotificationId("planner.ticket-mode"));
    // The safest main fallback keeps the workbench usable.
    expect(ctx.layout.getLayout().regions.main.widgets.map((placement) => placement.contributionId)).toEqual([
      "planner.editor",
    ]);
    expect(ctx.layout.getLayout().regions.main.widgets[0]?.role).toBe("location");
  });
});
