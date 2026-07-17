import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { getTestArea, registerTestWidget } from "./layout-model-test-utils";
import { getActiveWidgetId } from "./layout-operations";

describe("updateWidgetPlacement", () => {
  test("updates a widget placement without activating it", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, { id: "tickets.editor", title: "Ticket", area: "main" });
    registerTestWidget(layout, { id: "left.scratch", title: "Scratch", area: "left" });

    layout.openWidget("tickets.editor", {
      resource: { kind: "ticket", uri: "pstdio://ticket/1", label: "Old title" },
    });
    const scratch = layout.openWidget("left.scratch");

    const updated = layout.updateWidgetPlacement("tickets.editor", {
      resource: { kind: "ticket", uri: "pstdio://ticket/1", label: "New title" },
    });

    expect(updated.title).toBe("New title");
    expect(getActiveWidgetId(layout.getLayout())).toBe(scratch.widgetId);
    expect(getTestArea(layout.getLayout(), "main").activeWidgetId).toBe("tickets.editor");
    expect(getTestArea(layout.getLayout(), "left").activeWidgetId).toBe(scratch.widgetId);
  });

  test("keeps side-panel companion ownership on the placement", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "ticket.properties", title: "Properties", area: "side" });

    const placement = layout.openWidget("ticket.properties", { companionOfPrimary: true });

    expect(placement.companionOfPrimary).toBe(true);
    expect(layout.updateWidgetPlacement(placement.widgetId, { companionOfPrimary: false }).companionOfPrimary).toBe(
      false,
    );
  });
});

describe("createLayoutModel", () => {
  test("opens widgets in their contributed area and tracks active resource state", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "sessions.chat",
      title: "Session",
      area: "side",
      fallbackArea: "main",
      resourceKinds: ["session"],
      rendererId: "sessions.chat",
      config: { density: "compact" },
    });

    expect(layout.getWidget("sessions.chat")?.config).toEqual({ density: "compact" });

    const placement = layout.openWidget("sessions.chat", {
      resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
    });

    expect(placement).toMatchObject({
      widgetId: "sessions.chat",
      contributionId: "sessions.chat",
      resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
      resourceUri: "pstdio://session/s1",
      title: "Session 1",
    });
    expect(getActiveWidgetId(layout.getLayout())).toBe("sessions.chat");
    expect(layout.getLayout().activeResourceUri).toBe("pstdio://session/s1");
    expect(getTestArea(layout.getLayout(), "side").activeWidgetId).toBe("sessions.chat");
  });

  test("reuses singleton widget placements instead of adding duplicates", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "diagnostics.center",
      title: "Diagnostics",
      area: "secondary",
      singleton: true,
    });

    layout.openWidget("diagnostics.center");
    layout.openWidget("diagnostics.center");

    expect(getTestArea(layout.getLayout(), "secondary").widgets).toHaveLength(1);
  });

  test("registers widgets as singleton by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.overview",
      title: "Project overview",
      area: "main",
    });

    expect(layout.getWidget("project.overview")?.singleton).toBe(true);

    layout.openWidget("project.overview");
    layout.openWidget("project.overview");

    expect(getTestArea(layout.getLayout(), "main").widgets).toHaveLength(1);
  });

  test("opens non-singleton widgets as closable placements by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.singleton-panel",
      title: "Singleton panel",
      area: "main",
    });
    registerTestWidget(layout, {
      id: "project.tab",
      title: "Project tab",
      area: "main",
      singleton: false,
    });

    const panel = layout.openWidget("project.singleton-panel");
    const tab = layout.openWidget("project.tab");

    expect(panel.closable).toBe(false);
    expect(tab.closable).toBe(true);
  });

  test("keeps non-singleton widgets non-closable when they opt out", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.pinned-tab",
      title: "Pinned tab",
      area: "main",
      singleton: false,
      closable: false,
    });

    expect(layout.openWidget("project.pinned-tab").closable).toBe(false);
  });

  test("reuses matching resource placements by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.details",
      title: "Project details",
      area: "main",
      singleton: false,
      resourceKinds: ["project"],
    });

    const firstPlacement = layout.openWidget("project.details", {
      resource: { kind: "project", uri: "pstdio://project/p1", label: "Project 1" },
    });
    const secondPlacement = layout.openWidget("project.details", {
      resource: { kind: "project", uri: "pstdio://project/p1", label: "Project 1" },
      title: "Project 1 details",
    });

    expect(layout.getWidget("project.details")).toMatchObject({ singleton: false, reuse: "resource" });
    expect(secondPlacement.widgetId).toBe(firstPlacement.widgetId);
    expect(secondPlacement.title).toBe("Project 1 details");
    expect(getTestArea(layout.getLayout(), "main").widgets).toHaveLength(1);
  });

  test("opens separate default placements for different resources", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.details",
      title: "Project details",
      area: "main",
      singleton: false,
      resourceKinds: ["project"],
    });

    const firstPlacement = layout.openWidget("project.details", {
      resource: { kind: "project", uri: "pstdio://project/p1", label: "Project 1" },
    });
    const secondPlacement = layout.openWidget("project.details", {
      resource: { kind: "project", uri: "pstdio://project/p2", label: "Project 2" },
    });

    expect(secondPlacement.widgetId).not.toBe(firstPlacement.widgetId);
    expect(getTestArea(layout.getLayout(), "main").widgets.map((placement) => placement.resourceUri)).toEqual([
      "pstdio://project/p1",
      "pstdio://project/p2",
    ]);
  });

  test("reuses no-resource widget placements by default", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.settings",
      title: "Project settings",
      area: "main",
      singleton: false,
    });

    const firstPlacement = layout.openWidget("project.settings", { title: "Settings" });
    const secondPlacement = layout.openWidget("project.settings", { title: "Settings reopened" });

    expect(secondPlacement.widgetId).toBe(firstPlacement.widgetId);
    expect(secondPlacement.title).toBe("Settings reopened");
    expect(getTestArea(layout.getLayout(), "main").widgets).toHaveLength(1);
  });

  test("opens duplicate placements when reuse is disabled", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "scratch",
      title: "Scratch",
      area: "main",
      singleton: false,
      reuse: "none",
    });

    const firstPlacement = layout.openWidget("scratch");
    const secondPlacement = layout.openWidget("scratch");

    expect(secondPlacement.widgetId).not.toBe(firstPlacement.widgetId);
    expect(getTestArea(layout.getLayout(), "main").widgets).toHaveLength(2);
  });

  test("updates singleton placement resources when opened from a new resource", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.workspace",
      title: "Workspace",
      area: "main",
      singleton: true,
    });

    const firstPlacement = layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-266", label: "PS-266" },
    });
    const secondPlacement = layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-267", label: "PS-267" },
    });

    expect(secondPlacement.widgetId).toBe(firstPlacement.widgetId);
    expect(secondPlacement).toMatchObject({
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-267", label: "PS-267" },
      resourceUri: "pstdio://workspace/ps-267",
      title: "PS-267",
    });
    expect(layout.getLayout().activeResourceUri).toBe("pstdio://workspace/ps-267");
    expect(getTestArea(layout.getLayout(), "main").widgets).toHaveLength(1);
  });

  test("resolves area size from the active widget contribution", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.outline",
      title: "Outline",
      area: "side",
      areaSize: { defaultPx: 280, minPx: 180, maxPx: 360 },
    });
    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      area: "side",
      areaSize: { defaultPx: 420, minPx: 240, maxPx: 640 },
    });

    const outline = layout.openWidget("project.outline");
    layout.openWidget("project.preview");

    expect(layout.getAreaSize("side")).toEqual({ defaultPx: 420, minPx: 240, maxPx: 640 });

    layout.activateWidget(outline.widgetId);

    expect(layout.getAreaSize("side")).toEqual({ defaultPx: 280, minPx: 180, maxPx: 360 });
  });

  test("resolves area collapsibility from the active widget contribution", () => {
    const layout = createLayoutModel();

    registerTestWidget(layout, {
      id: "project.preview",
      title: "Preview",
      area: "secondary",
      areaCollapsible: true,
    });
    registerTestWidget(layout, {
      id: "project.console",
      title: "Console",
      area: "secondary",
      areaCollapsible: false,
    });

    const preview = layout.openWidget("project.preview");
    layout.openWidget("project.console");

    expect(layout.getAreaCollapsible("secondary")).toBe(false);

    layout.activateWidget(preview.widgetId);

    expect(layout.getAreaCollapsible("secondary")).toBe(true);
  });
});
