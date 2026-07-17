import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { getTestArea, registerTestWidget } from "./layout-model-test-utils";
import { getActiveWidgetId } from "./layout-operations";

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
    expect(getActiveWidgetId(layout.getLayout())).toBe(settings.widgetId);
    expect(getTestArea(layout.getLayout(), "main").activeWidgetId).toBe(settings.widgetId);
    expect(getTestArea(layout.getLayout(), "main").widgets.map((placement) => placement.widgetId)).toEqual([
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
    expect(getTestArea(layout.getLayout(), "main").widgets).toHaveLength(1);
    expect(getTestArea(layout.getLayout(), "main").widgets[0]).toEqual(placement);
    expect(getActiveWidgetId(layout.getLayout())).toBe("project.settings");
  });

  test("replaceActive removes the active placement when reusing an existing placement", () => {
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

    const tickets = layout.openWidget("project.tickets", {
      resource: { kind: "dashboard-view", uri: "pstdio://dashboard/tickets", label: "Tickets" },
    });
    layout.openWidget("project.settings", {
      resource: { kind: "settings", uri: "pstdio://settings/project", label: "Settings" },
    });

    const placement = layout.openWidget("project.tickets", {
      resource: { kind: "dashboard-view", uri: "pstdio://dashboard/tickets", label: "Tickets" },
      replaceActive: true,
    });

    expect(placement.widgetId).toBe(tickets.widgetId);
    expect(getTestArea(layout.getLayout(), "main").widgets).toEqual([placement]);
    expect(getActiveWidgetId(layout.getLayout())).toBe(tickets.widgetId);
  });

  test("moves a reusable placement when reopened in a different area without a resource update", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "ticket.files",
      title: "Files",
      area: "left",
    });

    const placement = layout.openWidget("ticket.files", { title: "Ticket files" });
    const moved = layout.openWidget("ticket.files", { area: "main-right", title: "Ticket files" });

    expect(moved.widgetId).toBe(placement.widgetId);
    expect(getTestArea(layout.getLayout(), "left").widgets).toEqual([]);
    expect(getTestArea(layout.getLayout(), "main-right").widgets).toEqual([moved]);
    expect(getTestArea(layout.getLayout(), "main-right").activeWidgetId).toBe(moved.widgetId);
    expect(getActiveWidgetId(layout.getLayout())).toBe(moved.widgetId);
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

    expect(getTestArea(layout.getLayout(), "main").widgets).toEqual([tickets]);
    expect(getTestArea(layout.getLayout(), "main").activeWidgetId).toBe(tickets.widgetId);
    expect(getActiveWidgetId(layout.getLayout())).toBe(tickets.widgetId);
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

    expect(getTestArea(layout.getLayout(), "main").widgets).toHaveLength(1);
    expect(getActiveWidgetId(layout.getLayout())).toBe("mode.editor");

    disposable.dispose();

    expect(getTestArea(layout.getLayout(), "main").widgets).toHaveLength(0);
    expect(getTestArea(layout.getLayout(), "main").activeWidgetId).toBeUndefined();
    expect(getActiveWidgetId(layout.getLayout())).toBeUndefined();
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

    expect(getTestArea(layout.getLayout(), "activity").widgets).toEqual([]);
    expect(getTestArea(layout.getLayout(), "left").widgets).toEqual([]);
    expect(getTestArea(layout.getLayout(), "main").widgets).toEqual([]);
    expect(getTestArea(layout.getLayout(), "main").activeWidgetId).toBeUndefined();
    expect(getActiveWidgetId(layout.getLayout())).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });

  test("resetAreas preserves node state", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "sessions.tree",
      title: "Sessions",
      area: "left",
    });
    layout.openWidget("sessions.tree");

    layout.setAreaVisible("left", false);
    const before = layout.getLayout().nodes.left;
    layout.resetAreas();

    expect(layout.getLayout().nodes.left).toEqual(before);
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

    expect(getTestArea(layout.getLayout(), "main").widgets).toEqual([]);
    expect(getTestArea(layout.getLayout(), "main").activeWidgetId).toBeUndefined();
    expect(getActiveWidgetId(layout.getLayout())).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });
});
