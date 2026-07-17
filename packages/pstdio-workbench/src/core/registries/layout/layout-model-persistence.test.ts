import { describe, expect, test } from "bun:test";
import { createLayoutModel, type LayoutScope, type WorkbenchLayout } from "./layout-model";
import { getTestArea, registerTestWidget } from "./layout-model-test-utils";
import { getActiveWidgetId } from "./layout-operations";

describe("createLayoutModel persistence", () => {
  test("discards persisted layouts from before normalized node state", () => {
    const partialLayout = { areas: { main: { id: "main", visible: true, widgets: [] } } } as unknown as WorkbenchLayout;
    const persistence = { getLayout: () => partialLayout, setLayout: () => undefined };

    const layout = createLayoutModel({ persistence });

    expect(getTestArea(layout.getLayout(), "left-header").widgets).toEqual([]);
    expect(getTestArea(layout.getLayout(), "secondary-header").widgets).toEqual([]);
    expect(getTestArea(layout.getLayout(), "floating-header").widgets).toEqual([]);
    expect(layout.getLayout().nodes).toEqual({});
  });

  test("exposes a store that notifies subscribers when the layout changes", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "project.settings", title: "Project settings", area: "main" });

    const activeIds: Array<string | undefined> = [];
    const unsubscribe = layout.store.subscribeSelector(
      (state) => getActiveWidgetId(state.layout),
      (id) => activeIds.push(id),
    );

    layout.openWidget("project.settings");
    layout.clearArea("main");

    expect(activeIds).toEqual(["project.settings", undefined]);
    unsubscribe();
  });

  test("persists layout state through an injected adapter", () => {
    const savedLayouts: WorkbenchLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: WorkbenchLayout) => savedLayouts.push(structuredClone(layoutState)),
    };
    const layout = createLayoutModel({ persistence });

    registerTestWidget(layout, { id: "project.settings", title: "Project settings", area: "main" });
    layout.openWidget("project.settings", {
      resource: { kind: "project", uri: "pstdio://project/project-1", label: "Prompt Studio" },
    });
    layout.persist();

    expect(savedLayouts.at(-1)?.activeSlotId).toBe("main");
    expect(savedLayouts.at(-1)?.activeResourceUri).toBe("pstdio://project/project-1");

    const rehydrated = createLayoutModel({ persistence });

    expect(getActiveWidgetId(rehydrated.getLayout())).toBe("project.settings");
    expect(getTestArea(rehydrated.getLayout(), "main").widgets[0]?.resourceUri).toBe("pstdio://project/project-1");
  });

  test("can unregister ephemeral widgets without persisting placement removal", () => {
    const savedLayouts: WorkbenchLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: WorkbenchLayout) => savedLayouts.push(structuredClone(layoutState)),
    };
    const layout = createLayoutModel({ persistence });
    registerTestWidget(layout, { id: "session-chat-bubble", title: "Session chat bubble", area: "floating" });
    layout.openWidget("session-chat-bubble");
    layout.persist();

    layout.unregisterWidget("session-chat-bubble", { removePlacements: false, persist: false });

    expect(layout.getWidget("session-chat-bubble")).toBeUndefined();
    expect(getTestArea(layout.getLayout(), "floating").widgets.map((widget) => widget.widgetId)).toEqual([
      "session-chat-bubble",
    ]);
    expect(savedLayouts.at(-1)?.areas.floating?.widgets.map((widget) => widget.widgetId)).toEqual([
      "session-chat-bubble",
    ]);
  });

  test("rotates resource-owned slots while preserving project-owned slots", () => {
    const saved = new Map<string, WorkbenchLayout>();
    const key = (scope?: LayoutScope) => JSON.stringify(scope ?? "__global__");
    const persistence = {
      getLayout: (scope?: LayoutScope) => saved.get(key(scope)),
      setLayout: (layoutState: WorkbenchLayout, scope?: LayoutScope) =>
        saved.set(key(scope), structuredClone(layoutState)),
    };
    const layout = createLayoutModel({ persistence });
    registerTestWidget(layout, { id: "project.tree", title: "Project tree", area: "left" });
    registerTestWidget(layout, {
      id: "workspace.editor",
      title: "Workspace editor",
      area: "main",
      singleton: false,
      reuse: "none",
    });

    layout.setPersistenceScope({ mode: "workspace", resource: "workspace:a" });
    layout.openWidget("project.tree");
    layout.openWidget("workspace.editor", {
      resource: { kind: "workspace", uri: "workspace:a", label: "Workspace A" },
    });
    layout.setAreaVisible("left", false);
    layout.setAreaSize("secondary", 200);

    layout.setPersistenceScope({ mode: "workspace", resource: "workspace:b" });

    expect(getTestArea(layout.getLayout(), "left").widgets.map((placement) => placement.widgetId)).toEqual([
      "project.tree",
    ]);
    expect(layout.getLayout().nodes.left?.collapsed).toBe(true);
    expect(getTestArea(layout.getLayout(), "main").widgets).toEqual([]);
    expect(layout.getLayout().nodes.secondary?.size).toBeUndefined();

    layout.openWidget("workspace.editor", {
      resource: { kind: "workspace", uri: "workspace:b", label: "Workspace B" },
    });
    layout.setAreaSize("secondary", 360);

    layout.setPersistenceScope({ mode: "workspace", resource: "workspace:a" });
    expect(getTestArea(layout.getLayout(), "main").widgets[0]?.resourceUri).toBe("workspace:a");
    expect(layout.getLayout().nodes.secondary?.size).toBe(200);

    layout.setPersistenceScope({ mode: "workspace", resource: "workspace:b" });
    expect(getTestArea(layout.getLayout(), "main").widgets[0]?.resourceUri).toBe("workspace:b");
    expect(layout.getLayout().nodes.secondary?.size).toBe(360);
  });

  test("scope === undefined falls back to global behavior", () => {
    const saved = new Map<string, WorkbenchLayout>();
    const persistence = {
      getLayout: () => saved.get("__global__"),
      setLayout: (layoutState: WorkbenchLayout) => saved.set("__global__", structuredClone(layoutState)),
    };
    const layout = createLayoutModel({ persistence });

    expect(layout.getPersistenceScope()).toBeUndefined();
    layout.setAreaSize("left", 280);
    layout.persist();
    expect(saved.get("__global__")?.nodes.left?.size).toBe(280);
  });

  test("persists area visibility and resize state through the layout model", () => {
    const savedLayouts: WorkbenchLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: WorkbenchLayout) => savedLayouts.push(structuredClone(layoutState)),
    };
    const layout = createLayoutModel({ persistence });

    layout.setAreaVisible("left", false);
    layout.setAreaSize("left", 312);
    layout.setAreaSize("secondary", 280);
    layout.persist();

    const rehydrated = createLayoutModel({ persistence });

    expect(rehydrated.getLayout().nodes.left?.collapsed).toBe(true);
    expect(rehydrated.getLayout().nodes.left?.size).toBe(312);
    expect(rehydrated.getAreaSize("left")?.defaultPx).toBe(312);
    expect(rehydrated.getLayout().nodes.secondary?.size).toBe(280);
  });
});
