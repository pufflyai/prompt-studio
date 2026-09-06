import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

describe("mode placement registry", () => {
  test("opens a View menu for an active mode placement", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "artifacts",
      title: "Artifacts",
      body: { kind: "react", render: () => null },
    });
    workbench.views.registerView({
      id: "artifact-create",
      title: "Create artifacts",
      body: { kind: "react", render: () => null },
    });
    workbench.viewMenus.registerViewMenu({
      id: "artifacts.create",
      ownerViewId: "artifacts",
      viewId: "artifact-create",
      side: "right",
    });
    workbench.views.registerView({
      id: "activity",
      title: "Activity",
      body: { kind: "react", render: () => null },
    });
    workbench.shellPlacements.registerPlacement({
      id: "activity",
      item: {
        kind: "view",
        presence: "closed",
        view: {
          kind: "view",
          id: "activity",
        },
      },
      region: "activity",
    });
    workbench.modes.registerMode({ id: "lab", activate: () => undefined });
    workbench.views.registerView({
      id: "overview",
      title: "Overview",
      body: { kind: "react", render: () => null },
    });
    workbench.pages.registerPage({
      id: "lab",
      ref: { extensionId: "test", kind: "page", id: "lab" },
      modeId: "lab",
      path: "lab",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "overview",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.modePlacements.registerPlacement({
      id: "lab.artifacts",
      ref: { extensionId: "test", kind: "placement", id: "artifacts" },
      modeId: "lab",
      item: {
        kind: "view",
        presence: "open",
        view: {
          kind: "view",
          id: "artifacts",
        },
      },
      region: "main",
    });
    workbench.modes.onDidChangeActive(() => {
      if (workbench.modes.getActiveModeId() !== "lab") return;
      void workbench.navigation.openPanel({ panel: { kind: "shell-placement", id: "activity" } });
    });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: { extensionId: "test", kind: "page", id: "lab" } });
    const layout = workbench.layout.getLayout();
    expect(layout.regions.main.activeWidgetId).toBe(layout.activeLocationWidgetId);
    expect(
      layout.regions.main.widgets.find((widget) => widget.widgetId === layout.activeLocationWidgetId)?.viewId,
    ).toBe("overview");
    expect(workbench.layout.getLayout().regions["main-right-menu"].widgets).toEqual([
      expect.objectContaining({
        viewId: "artifact-create",
        role: "panel-menu",
      }),
    ]);
  });
  test("updates a resource placement without replacing its mounted instance", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "session",
      title: "Session",
      body: { kind: "react", render: () => null },
    });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({
      id: "start",
      title: "Start",
      body: { kind: "react", render: () => null },
    });
    workbench.pages.registerPage({
      id: "start",
      ref: { extensionId: "pstdio", kind: "page", id: "start" },
      modeId: "project",
      path: "",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "start",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.modePlacements.registerPlacement({
      id: "project.session",
      ref: { extensionId: "pstdio", kind: "placement", id: "session" },
      modeId: "project",
      item: {
        kind: "binding",
        binding: {
          kinds: [
            {
              kind: "resource-kind",
              id: "session",
            },
            {
              kind: "resource-kind",
              id: "session-draft",
            },
          ],
          view: {
            kind: "view",
            id: "session",
          },
          cardinality: "many",
        },
      },
      region: "side",
    });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({
      kind: "page",
      page: { extensionId: "pstdio", kind: "page", id: "start" },
    });
    const identity = workbench.modePlacements.openPlacement({
      panel: { extensionId: "pstdio", kind: "placement", id: "session" },
      resource: {
        type: "session-draft",
        label: "New session",
        id: "pstdio://session-draft/new",
      },
      open: "pin",
    });
    const before = workbench.layout.getLayout().regions.side.widgets[0];
    workbench.modePlacements.updatePlacement(identity, {
      resource: {
        type: "session",
        label: "First session",
        id: "pstdio://session/SESSION-1",
      },
      title: "First session",
    });
    const after = workbench.layout.getLayout().regions.side.widgets[0];
    expect(after?.widgetId).toBe(before?.widgetId);
    expect(after?.resource?.type).toBe("session");
    expect(after?.resource?.id).toBe("pstdio://session/SESSION-1");
    expect(after?.title).toBe("First session");
  });
});
