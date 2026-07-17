import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { getTestArea, registerTestWidget } from "./layout-model-test-utils";
import { getActiveWidgetId } from "./layout-operations";

describe("createLayoutModel moveWidget", () => {
  test("reorders a slot without changing its effective active placement", () => {
    const layout = createLayoutModel();
    for (const id of ["terminal.one", "terminal.two", "terminal.three"]) {
      registerTestWidget(layout, { id, title: id, area: "secondary" });
      layout.openWidget(id, {
        resource: { kind: "workspace", uri: `pstdio://workspace/${id}` },
      });
    }

    const current = layout.getLayout();
    const secondary = getTestArea(current, "secondary");
    layout.restoreLayout({
      ...current,
      activeSlotId: "secondary",
      activeResourceUri: secondary.widgets[0]?.resourceUri,
      areas: {
        ...current.areas,
        secondary: { ...secondary, activeWidgetId: undefined },
      },
    });

    const moved = layout.moveWidget("terminal.three", { areaId: "secondary", index: 0 });

    expect(moved?.widgetId).toBe("terminal.three");
    expect(getTestArea(layout.getLayout(), "secondary").widgets.map((placement) => placement.widgetId)).toEqual([
      "terminal.three",
      "terminal.one",
      "terminal.two",
    ]);
    expect(getTestArea(layout.getLayout(), "secondary").activeWidgetId).toBe("terminal.one");
    expect(getActiveWidgetId(layout.getLayout())).toBe("terminal.one");
    expect(layout.getLayout().activeResourceUri).toBe("pstdio://workspace/terminal.one");
  });

  test("moves the active placement across slots and repairs both areas", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "terminal.one", title: "Terminal one", area: "secondary" });
    registerTestWidget(layout, { id: "terminal.two", title: "Terminal two", area: "secondary" });
    registerTestWidget(layout, { id: "session.chat", title: "Session chat", area: "floating" });
    const first = layout.openWidget("terminal.one");
    const moved = layout.openWidget("terminal.two", {
      resource: { kind: "workspace", uri: "pstdio://workspace/terminal-two" },
    });
    const session = layout.openWidget("session.chat");
    layout.activateWidget(moved.widgetId);

    const result = layout.moveWidget(moved.widgetId, { areaId: "floating", index: 0 });

    expect(result).toEqual(moved);
    expect(getTestArea(layout.getLayout(), "secondary")).toMatchObject({
      widgets: [first],
      activeWidgetId: first.widgetId,
    });
    expect(getTestArea(layout.getLayout(), "floating")).toMatchObject({
      widgets: [moved, session],
      activeWidgetId: moved.widgetId,
    });
    expect(layout.getLayout()).toMatchObject({
      activeSlotId: "floating",
      activeResourceUri: "pstdio://workspace/terminal-two",
    });
    expect(getActiveWidgetId(layout.getLayout())).toBe(moved.widgetId);
  });

  test("keeps resource binding intact when moving a placement", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "workspace.diff", title: "Workspace diff", area: "secondary" });
    const placement = layout.openWidget("workspace.diff", {
      resource: { kind: "workspace", uri: "pstdio://workspace/a", label: "Workspace A" },
    });

    const moved = layout.moveWidget(placement.widgetId, { areaId: "floating" });

    expect(moved?.resource).toEqual(placement.resource);
    expect(moved?.resourceUri).toBe("pstdio://workspace/a");
  });

  test("returns undefined for an unknown placement", () => {
    const layout = createLayoutModel();

    expect(layout.moveWidget("missing", { areaId: "secondary" })).toBeUndefined();
  });

  test("rejects cross-slot moves into the primary frame slot", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "terminal", title: "Terminal", area: "secondary" });
    const placement = layout.openWidget("terminal");

    expect(() => layout.moveWidget(placement.widgetId, { areaId: "main" })).toThrow(
      "Cannot move a widget into the primary slot: main",
    );
  });
});
