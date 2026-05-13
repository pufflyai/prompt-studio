import { describe, expect, test } from "bun:test";
import { createLayoutModel, type ShellLayout } from "./layout-model";

describe("createLayoutModel", () => {
  test("opens widgets in their contributed area and tracks active resource state", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "sessions.chat",
      title: "Session",
      area: "main-right",
      fallbackArea: "main",
      resourceKinds: ["session"],
      renderer: "react",
      rendererId: "sessions.chat",
    });

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
    expect(layout.getLayout().activeWidgetId).toBe("sessions.chat");
    expect(layout.getLayout().activeResourceUri).toBe("pstdio://session/s1");
    expect(layout.getLayout().areas["main-right"].activeWidgetId).toBe("sessions.chat");
  });

  test("reuses singleton widget placements instead of adding duplicates", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "diagnostics.center",
      title: "Diagnostics",
      area: "main-bottom",
      singleton: true,
      renderer: "react",
    });

    layout.openWidget("diagnostics.center");
    layout.openWidget("diagnostics.center");

    expect(layout.getLayout().areas["main-bottom"].widgets).toHaveLength(1);
  });

  test("updates singleton placement resources when opened from a new resource", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "project.workspace",
      title: "Workspace",
      area: "main",
      singleton: true,
      renderer: "react",
    });

    const firstPlacement = layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-266", label: "PS-266" },
    });
    const secondPlacement = layout.openWidget("project.workspace", {
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-267", label: "PS-267" },
    });

    expect(secondPlacement).toBe(firstPlacement);
    expect(secondPlacement).toMatchObject({
      resource: { kind: "workspace", uri: "pstdio://workspace/ps-267", label: "PS-267" },
      resourceUri: "pstdio://workspace/ps-267",
      title: "PS-267",
    });
    expect(layout.getLayout().activeResourceUri).toBe("pstdio://workspace/ps-267");
    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
  });

  test("activates an existing widget placement without adding a duplicate", () => {
    const layout = createLayoutModel();

    layout.registerWidget({
      id: "project.settings",
      title: "Project settings",
      area: "main",
      renderer: "react",
    });
    layout.registerWidget({
      id: "sessions.chat",
      title: "Session chat",
      area: "main",
      renderer: "react",
    });

    const settings = layout.openWidget("project.settings");
    layout.openWidget("sessions.chat");

    const activated = layout.activateWidget(settings.widgetId);

    expect(activated).toBe(settings);
    expect(layout.getLayout().activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().areas.main.activeWidgetId).toBe(settings.widgetId);
    expect(layout.getLayout().areas.main.widgets.map((placement) => placement.widgetId)).toEqual([
      "project.settings",
      "sessions.chat",
    ]);
  });

  test("removes placements when a widget contribution is disposed", () => {
    const layout = createLayoutModel();

    const disposable = layout.registerWidget({
      id: "mode.editor",
      title: "Editor",
      area: "main",
      renderer: "react",
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

  test("fills in missing areas when loading a layout persisted before new areas existed", () => {
    const partialLayout = {
      areas: {
        main: { id: "main", visible: true, widgets: [] },
      },
    } as unknown as ShellLayout;
    const persistence = {
      getLayout: () => partialLayout,
      setLayout: () => undefined,
    };

    const layout = createLayoutModel({ persistence });

    expect(layout.getLayout().areas["left-header"]).toBeDefined();
    expect(layout.getLayout().areas["main-bottom-header"]).toBeDefined();
    expect(layout.getLayout().areas["left-header"].widgets).toEqual([]);
  });

  test("persists layout state through an injected adapter", () => {
    const savedLayouts: ShellLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layoutState: ShellLayout) => {
        savedLayouts.push(structuredClone(layoutState));
      },
    };
    const layout = createLayoutModel({ persistence });

    layout.registerWidget({
      id: "project.settings",
      title: "Project settings",
      area: "main",
      renderer: "react",
    });

    layout.openWidget("project.settings", {
      resource: { kind: "project", uri: "pstdio://project/project-1", label: "Prompt Studio" },
    });

    expect(savedLayouts.at(-1)?.activeWidgetId).toBe("project.settings");
    expect(savedLayouts.at(-1)?.activeResourceUri).toBe("pstdio://project/project-1");

    const rehydrated = createLayoutModel({ persistence });

    expect(rehydrated.getLayout().activeWidgetId).toBe("project.settings");
    expect(rehydrated.getLayout().areas.main.widgets[0]?.resourceUri).toBe("pstdio://project/project-1");
  });
});
