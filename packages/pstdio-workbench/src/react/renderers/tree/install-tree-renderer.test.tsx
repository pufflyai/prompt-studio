import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { installWorkbenchTreeRenderer } from "./install-tree-renderer";

describe("installWorkbenchTreeRenderer", () => {
  test("passes the host param field renderer to tree action dialogs", () => {
    const workbench = createWorkbenchCore();
    const renderParamField: CommandParamFieldRenderer = () => undefined;

    installWorkbenchTreeRenderer(workbench, { renderParamField });
    workbench.renderers.registerTreeRenderer({
      id: "project.tree",
      title: "Project",
      getBody: () => [],
      getChildren: () => [],
    });

    const renderer = workbench.renderers.getRenderer("project.tree");
    const rendered = renderer?.render({
      workbench,
      panel: workbench.layout.registerPanel({
        closable: false,
        id: "project.tree",
        title: "Project",
        region: "sidenav",
        rendererId: "project.tree",
      }) as never,
      instance: { instanceId: "project.tree", panelId: "project.tree", closable: false, title: "Project" },
      refresh: () => undefined,
    }) as { props?: { renderParamField?: CommandParamFieldRenderer } };

    expect(rendered.props?.renderParamField).toBe(renderParamField);
  });
});
