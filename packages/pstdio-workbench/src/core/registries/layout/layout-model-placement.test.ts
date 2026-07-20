import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";

describe("createLayoutModel widget placement", () => {
  test("activates an existing widget placement without adding a duplicate", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session chat",
      region: "main",
    });

    const settings = layout.openWidget("project.settings");
    layout.openWidget("sessions.chat");

    const activated = layout.activateWidget(settings.widgetId);

    expect(activated.widgetId).toBe(settings.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().regions.main.activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().regions.main.widgets.map((placement) => placement.widgetId)).toEqual([
      "project.settings",
      "sessions.chat",
    ]);
  });

  test("replaces the active widget placement when requested", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
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
    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.main.widgets[0]).toEqual(placement);
    expect(layout.getLayout().activeWidgetId).toBe("project.settings");
  });

  test("replaceActive removes the active placement when reusing an existing placement", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
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
    expect(layout.getLayout().regions.main.widgets).toEqual([placement]);
    expect(layout.getLayout().activeWidgetId).toBe(tickets.widgetId);
  });

  test("moves a reusable placement when reopened in a different region without a resource update", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "ticket.files",
      title: "Files",
      region: "sidebar",
    });

    const placement = layout.openWidget("ticket.files", { title: "Ticket files" });
    const moved = layout.openWidget("ticket.files", { region: "main-right-menu", title: "Ticket files" });

    expect(moved.widgetId).toBe(placement.widgetId);
    expect(layout.getLayout().regions.sidebar.widgets).toEqual([]);
    expect(layout.getLayout().regions["main-right-menu"].widgets).toEqual([moved]);
    expect(layout.getLayout().regions["main-right-menu"].activeWidgetId).toBe(moved.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(moved.widgetId);
  });

  test("closes closable widget placements", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
      closable: true,
    });

    const tickets = layout.openWidget("project.tickets");
    const settings = layout.openWidget("project.settings");

    layout.closeWidget(settings.widgetId);

    expect(layout.getLayout().regions.main.widgets).toEqual([tickets]);
    expect(layout.getLayout().regions.main.activeWidgetId).toBe(tickets.widgetId);
    expect(layout.getLayout().activeWidgetId).toBe(tickets.widgetId);
    expect(() => layout.closeWidget(tickets.widgetId)).toThrow("Widget cannot be closed: project.tickets");
  });

  test("removes placements when a widget contribution is disposed", () => {
    const layout = createLayoutModel();

    const disposable = registerTestWidget(layout, {
      id: "mode.editor",
      title: "Editor",
      region: "main",
    });

    layout.openWidget("mode.editor", {
      resource: { kind: "note", uri: "pstdio://note/1", label: "Note 1" },
    });

    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
    expect(layout.getLayout().activeWidgetId).toBe("mode.editor");

    disposable.dispose();

    expect(layout.getLayout().regions.main.widgets).toHaveLength(0);
    expect(layout.getLayout().regions.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });

  test("resets every region and clears active workbench selection", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "modes.switcher",
      title: "Modes",
      region: "activity",
    });
    registerTestWidget(layout, {
      id: "sessions.tree",
      title: "Sessions",
      region: "sidebar",
    });
    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session",
      region: "main",
    });

    layout.openWidget("modes.switcher", { pinned: true });
    layout.openWidget("sessions.tree");
    layout.openWidget("sessions.chat", {
      resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
    });

    layout.resetRegions();

    expect(layout.getLayout().regions.activity.widgets).toEqual([]);
    expect(layout.getLayout().regions.sidebar.widgets).toEqual([]);
    expect(layout.getLayout().regions.main.widgets).toEqual([]);
    expect(layout.getLayout().regions.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });

  test("resetRegions preserves region visibility", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "sessions.tree",
      title: "Sessions",
      region: "sidebar",
    });
    layout.openWidget("sessions.tree");

    const before = layout.getLayout().regions.sidebar.visible;
    layout.resetRegions();

    expect(layout.getLayout().regions.sidebar.visible).toBe(before);
  });

  test("clears an region and active workbench selection", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.tickets",
      title: "Tickets",
      region: "main",
    });
    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      region: "main",
    });

    layout.openWidget("project.tickets");
    layout.openWidget("project.settings", {
      resource: { kind: "project", uri: "pstdio://project/project-1", label: "Project" },
    });

    layout.clearRegion("main");

    expect(layout.getLayout().regions.main.widgets).toEqual([]);
    expect(layout.getLayout().regions.main.activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeWidgetId).toBeUndefined();
    expect(layout.getLayout().activeResourceUri).toBeUndefined();
  });
});
