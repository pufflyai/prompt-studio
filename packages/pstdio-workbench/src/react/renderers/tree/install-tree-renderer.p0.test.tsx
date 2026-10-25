import { describe, expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { installWorkbenchTreeRenderer } from "./install-tree-renderer";

const activateHostPage = (workbench: ReturnType<typeof createWorkbench>) => {
  workbench.views.registerView({ id: "host", title: "Host", body: { kind: "react", render: () => null } });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.pages.registerPage({
    id: "host",
    ref: { extensionId: "pstdio", kind: "page", id: "host" },
    modeId: "project",
    path: "",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "host",
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({
    kind: "page",
    page: { extensionId: "pstdio", kind: "page", id: "host" },
  });
};
describe("installWorkbenchTreeRenderer", () => {
  test("passes the host param field renderer to tree action dialogs", () => {
    const workbench = createWorkbench();
    const renderParamField: CommandParamFieldRenderer = () => undefined;
    installWorkbenchTreeRenderer(workbench, { renderParamField });
    workbench.views.registerView({
      id: "project.tree",
      title: "Project",
      body: { kind: "tree", getBody: () => [], getChildren: () => [] },
    });
    workbench.shellPlacements.registerPlacement({
      id: "project.tree",
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: "project.tree",
        },
      },
      region: "main",
    });
    activateHostPage(workbench);
    const renderer = getWorkbenchRenderers(workbench).getRenderer("project.tree");
    const instance = workbench.layout
      .listPanelInstances("main")
      .find((candidate) => candidate.viewId === "project.tree")!;
    const panel = workbench.layout.getPanel(instance.panelId);
    if (!panel) throw new Error("Project tree view was not registered");
    const rendered = renderer?.render({
      workbench,
      panel,
      instance,
      refresh: () => undefined,
    }) as {
      props?: {
        renderParamField?: CommandParamFieldRenderer;
      };
    };
    expect(rendered.props?.renderParamField).toBe(renderParamField);
  });
  test("uses the live placement region instead of the view default", () => {
    const workbench = createWorkbench();
    const onSidenavContextActionsChange = () => undefined;
    installWorkbenchTreeRenderer(workbench, { onSidenavContextActionsChange });
    workbench.views.registerView({
      id: "project.navigation",
      title: "Project",
      body: { kind: "tree", getBody: () => [], getChildren: () => [] },
    });
    workbench.shellPlacements.registerPlacement({
      id: "project.navigation",
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: "project.navigation",
        },
      },
      region: "sidenav",
    });
    activateHostPage(workbench);
    const instance = workbench.layout
      .listPanelInstances("sidenav")
      .find((candidate) => candidate.viewId === "project.navigation")!;
    const panel = workbench.layout.getPanel(instance.panelId);
    if (!panel) throw new Error("Project navigation view was not registered");
    const rendered = getWorkbenchRenderers(workbench)
      .getRenderer("project.navigation")
      ?.render({
        workbench,
        panel,
        instance,
        refresh: () => undefined,
      }) as {
      props?: {
        onSidenavContextActionsChange?: () => void;
      };
    };
    expect(rendered.props?.onSidenavContextActionsChange).toBe(onSidenavContextActionsChange);
  });
});
