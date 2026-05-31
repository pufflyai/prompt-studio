import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";

describe("createLayoutModel widget placement", () => {
  test("activates an existing widget placement without adding a duplicate", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session chat",
      area: "main",
    });

    const settings = layout.openWidget("project.settings");
    layout.openWidget("sessions.chat");

    const activated = layout.activateWidget(settings.widgetId);

    expect(activated.widgetId).toBe(settings.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().areas.main.activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().areas.main.widgets.map((placement) => placement.widgetId)).toEqual([
      "project.settings",
      "sessions.chat",
    ]);
  });

  test("replaces the active widget placement when requested", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
    });

    layout.openWidget("project.tickets", {
      resource: { kind: "dashboard-view", uri: "pstdio://dashboard/tickets", label: "Tickets" },
    });
    const placement = layout.openWidget("project.settings", {
      resource: { kind: "settings", uri: "pstdio://settings/project", label: "Settings" },
      replaceActive: true,
    });

    expect(placement).toMatchObject({
      widgetId: "project.settings",
      contributionId: "project.settings",
      resourceUri: "pstdio://settings/project",
      title: "Settings",
    });
    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
    expect(layout.getLayout().areas.main.widgets[0]).toEqual(placement);
    expect(layout.getLayout().activeWidgetId).toBe("project.settings");
  });

  test("closes closable widget placements", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
      closable: true,
    });

    const tickets = layout.openWidget("project.tickets");
    const settings = layout.openWidget("project.settings");

    layout.closeWidget(settings.widgetId);

    expect(layout.getLayout().areas.main.widgets).toEqual([tickets]);
    expect(layout.getLayout().areas.main.activeWidgetId).toBe(tickets.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(tickets.widgetId);
    expect(() => layout.closeWidget(tickets.widgetId)).toThrow("Widget cannot be closed: project.tickets");
  });

  test("removes placements when a widget contribution is disposed", () => {
    const layout = createLayoutModel();

    const disposable = registerTestWidget(layout, {
      id: "mode.editor",
      title: "Editor",
      area: "main",
    });

    layout.openWidget("mode.editor", {
      resource: { kind: "note", uri: "pstdio://note/1", label: "Note 1" },
    });

    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
    expect(layout.getLayout().activeWidgetId).toBe("mode.editor");

    disposable.dispose();

    expect(layout.getLayout().areas.main.widgets).toHaveLength(0);
    expect(layout.getLayout().areas.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });

  test("resets every area and clears active workbench selection", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "modes.switcher",
      title: "Modes",
      area: "activity",
    });
    registerTestWidget(layout, {
      id: "sessions.tree",
      title: "Sessions",
      area: "left",
    });
    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session",
      area: "main",
    });

    layout.openWidget("modes.switcher", { pinned: true });
    layout.openWidget("sessions.tree");
    layout.openWidget("sessions.chat", {
      resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
    });

    layout.resetAreas();

    expect(layout.getLayout().areas.activity.widgets).toEqual([]);
    expect(layout.getLayout().areas.left.widgets).toEqual([]);
    expect(layout.getLayout().areas.main.widgets).toEqual([]);
    expect(layout.getLayout().areas.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });

  test("resetAreas preserves area visibility", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "sessions.tree",
      title: "Sessions",
      area: "left",
    });
    layout.openWidget("sessions.tree");

    const before = layout.getLayout().areas.left.visible;
    layout.resetAreas();

    expect(layout.getLayout().areas.left.visible).toBe(before);
  });

  test("clears an area and active workbench selection", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
    });

    layout.openWidget("project.tickets");
    layout.openWidget("project.settings", {
      resource: { kind: "project", uri: "pstdio://project/project-1", label: "Project" },
    });

    layout.clearArea("main");

    expect(layout.getLayout().areas.main.widgets).toEqual([]);
    expect(layout.getLayout().areas.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });
});
