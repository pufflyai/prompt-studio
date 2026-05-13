import { describe, expect, it } from "bun:test";
import { activateProductModule, createShellCore, type ProductModuleContribution } from "./shell-core";

describe("activateProductModule", () => {
  it("wires a product module through shell resources, widgets, commands, menus, notifications, and trees", async () => {
    const shell = createShellCore();
    const projectResource = {
      kind: "project",
      uri: "pstdio://project/project-1",
      id: "project-1",
      label: "Prompt Studio",
    };
    const module: ProductModuleContribution = {
      id: "dashboard.project",
      activate(ctx) {
        ctx.notifications.show({
          id: "project.ready",
          level: "success",
          title: "Project ready",
        });

        return [
          ctx.resources.registerKind({ kind: "project", label: "Project", icon: "folder" }),
          ctx.layout.registerWidget({
            id: "project.settings",
            title: "Project settings",
            area: "main",
            singleton: true,
            resourceKinds: ["project"],
            renderer: "react",
            rendererId: "project.settings",
          }),
          ctx.commands.registerCommand(
            { id: "project.openSettings", label: "Open project settings", category: "Project" },
            {
              execute: () => ctx.layout.openWidget("project.settings", { resource: projectResource }),
            },
          ),
          ctx.menus.registerMenuAction(["commandPalette"], {
            commandId: "project.openSettings",
            label: "Open project settings",
          }),
          ctx.trees.registerTreeView({
            id: "project.navigation",
            title: "Project",
            getRoots: () => [{ id: "project-1", label: "Prompt Studio", resource: projectResource }],
            getChildren: () => [],
          }),
        ];
      },
    };

    const disposable = activateProductModule(shell, module);

    expect(shell.resources.getKind("project")?.ownerId).toBe("dashboard.project");
    expect(shell.resources.getKind("project")?.source).toBe("product-module");
    expect(shell.layout.getWidget("project.settings")?.ownerId).toBe("dashboard.project");
    expect(shell.commands.getCommand("project.openSettings")?.ownerId).toBe("dashboard.project");
    expect(shell.menus.listMenuActions(["commandPalette"])[0]?.ownerId).toBe("dashboard.project");
    expect(shell.notifications.listNotifications()[0]?.ownerId).toBe("dashboard.project");
    expect((await shell.trees.getRoots("project.navigation"))[0]?.resource?.uri).toBe(projectResource.uri);

    await shell.commands.executeCommand("project.openSettings");

    expect(shell.layout.getLayout().activeWidgetId).toBe("project.settings");
    expect(shell.layout.getLayout().activeResourceUri).toBe(projectResource.uri);

    disposable.dispose();

    expect(shell.commands.getCommand("project.openSettings")).toBeUndefined();
  });
});
