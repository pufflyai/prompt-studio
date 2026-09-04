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
      item: { kind: "view", viewId: "activity", presence: "closed" },
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
      slots: [{ id: "content", role: "primary", region: "main", viewId: "overview" }],
    });
    workbench.modePlacements.registerPlacement({
      id: "lab.artifacts",
      ref: { extensionId: "test", kind: "placement", id: "artifacts" },
      modeId: "lab",
      item: { kind: "view", viewId: "artifacts", presence: "open" },
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
      slots: [{ id: "content", role: "primary", region: "main", viewId: "start" }],
    });
    workbench.modePlacements.registerPlacement({
      id: "project.session",
      ref: { extensionId: "pstdio", kind: "placement", id: "session" },
      modeId: "project",
      item: {
        kind: "resource",
        viewId: "session",
        resourceKinds: ["session", "session-draft"],
        cardinality: "many",
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
      resource: { kind: "session-draft", uri: "pstdio://session-draft/new", label: "New session" },
      open: "pin",
    });
    const before = workbench.layout.getLayout().regions.side.widgets[0];

    workbench.modePlacements.updatePlacement(identity, {
      resource: { kind: "session", uri: "pstdio://session/SESSION-1", label: "First session" },
      title: "First session",
    });

    const after = workbench.layout.getLayout().regions.side.widgets[0];
    expect(after?.widgetId).toBe(before?.widgetId);
    expect(after?.resource?.kind).toBe("session");
    expect(after?.resourceUri).toBe("pstdio://session/SESSION-1");
    expect(after?.title).toBe("First session");
  });
});
