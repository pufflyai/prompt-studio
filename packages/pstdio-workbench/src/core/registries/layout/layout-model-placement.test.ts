import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import { defineFrame } from "./frame";
import { createLayoutModel } from "./layout-model";
import { getTestArea, registerTestWidget } from "./layout-model-test-utils";
import { getActiveWidgetId } from "./layout-operations";

describe("frame slot placement", () => {
  test("opens a widget into a non-classic slot declared by the active frame", () => {
    const shellFrame = defineFrame({
      id: "shell",
      root: {
        kind: "split",
        id: "shell-root",
        direction: "row",
        children: [classicFrame.slots.main, { kind: "slot", id: "tool-rail", owner: "project", role: "chrome" }],
      },
      primary: "main",
    });
    const layout = createLayoutModel({ frame: shellFrame });
    registerTestWidget(layout, { id: "tools.rail", title: "Tools", area: "tool-rail" });

    const placement = layout.openWidget("tools.rail");

    expect(getTestArea(layout.getLayout(), "tool-rail").widgets).toEqual([placement]);
    expect(layout.getLayout().activeSlotId).toBe("tool-rail");
  });
});

describe("createLayoutModel widget placement", () => {
  test("quarantines a widget opened into a slot outside the active frame", () => {
    const focusFrame = defineFrame({
      id: "focus",
      root: classicFrame.slots.main,
      primary: "main",
    });
    const layout = createLayoutModel();
    registerTestWidget(layout, {
      id: "project.output",
      title: "Output",
      area: "secondary",
    });

    layout.setFrame(focusFrame);
    const placement = layout.openWidget("project.output");

    expect(layout.getLayout().areas.secondary).toBeUndefined();
    expect(layout.getLayout().orphans?.secondary?.widgets).toEqual([placement]);
    expect(layout.getLayout().activeSlotId).not.toBe("secondary");

    layout.setFrame(classicFrame);

    expect(getTestArea(layout.getLayout(), "secondary").widgets).toEqual([placement]);
  });

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
    const moved = layout.openWidget("ticket.files", { area: "side", title: "Ticket files" });

    expect(moved.widgetId).toBe(placement.widgetId);
    expect(getTestArea(layout.getLayout(), "left").widgets).toEqual([]);
    expect(getTestArea(layout.getLayout(), "side").widgets).toEqual([moved]);
    expect(getTestArea(layout.getLayout(), "side").activeWidgetId).toBe(moved.widgetId);
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

describe("restored widget placement ids", () => {
  test("allocates a unique id after restoring duplicate widget placements", () => {
    const first = createLayoutModel();
    registerTestWidget(first, {
      id: "terminal",
      title: "Terminal",
      area: "main",
      singleton: false,
      reuse: "none",
    });

    first.openWidget("terminal");
    first.openWidget("terminal");

    const restored = createLayoutModel({
      persistence: {
        getLayout: () => first.getLayout(),
        setLayout: () => undefined,
      },
    });
    registerTestWidget(restored, {
      id: "terminal",
      title: "Terminal",
      area: "main",
      singleton: false,
      reuse: "none",
    });

    expect(restored.openWidget("terminal").widgetId).toBe("terminal:2");
    expect(getTestArea(restored.getLayout(), "main").widgets.map((placement) => placement.widgetId)).toEqual([
      "terminal",
      "terminal:1",
      "terminal:2",
    ]);
  });
});
