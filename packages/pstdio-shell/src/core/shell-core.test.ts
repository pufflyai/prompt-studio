import { describe, expect, it } from "bun:test";
import { createShellCore, type ShellModuleContribution } from "./shell-core";

describe("shell modules", () => {
  it("registers a module through shell resources, widgets, commands, menus, notifications, and trees", async () => {
    const shell = createShellCore();
    const projectResource = {
      kind: "project",
      uri: "pstdio://project/project-1",
      id: "project-1",
      label: "Prompt Studio",
    };
    const module: ShellModuleContribution = {
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

    const disposable = shell.registerModule(module);

    expect(shell.resources.getKind("project")?.ownerId).toBe("dashboard.project");
    expect(shell.resources.getKind("project")?.source).toBe("module");
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

  it("auto-tracks module registrations and unregisters them by module id", () => {
    const shell = createShellCore();

    shell.registerModule({
      id: "dashboard.project",
      activate(ctx) {
        ctx.resources.registerKind({ kind: "project", label: "Project" });
        ctx.commands.registerCommand({ id: "project.open", label: "Open project" }, { execute: () => undefined });
        ctx.menus.registerMenuAction(["commandPalette"], { commandId: "project.open" });
      },
    });

    expect(shell.resources.getKind("project")?.source).toBe("module");
    expect(shell.commands.getCommand("project.open")?.ownerId).toBe("dashboard.project");
    expect(shell.menus.listMenuActions(["commandPalette"])).toHaveLength(1);

    shell.unregisterModule("dashboard.project");

    expect(shell.resources.getKind("project")).toBeUndefined();
    expect(shell.commands.getCommand("project.open")).toBeUndefined();
    expect(shell.menus.listMenuActions(["commandPalette"])).toEqual([]);
  });

  it("rejects duplicate module ids and keeps stale disposables from removing newer modules", () => {
    const shell = createShellCore();
    const createModule = (label: string): ShellModuleContribution => ({
      id: "dashboard.project",
      activate(ctx) {
        ctx.commands.registerCommand({ id: "project.open", label }, { execute: () => undefined });
      },
    });

    const first = shell.registerModule(createModule("First"));

    expect(() => shell.registerModule(createModule("Duplicate"))).toThrow(
      "Shell module already registered: dashboard.project",
    );

    shell.unregisterModule("dashboard.project");
    shell.registerModule(createModule("Second"));
    first.dispose();

    expect(shell.commands.getCommand("project.open")?.command.label).toBe("Second");
  });

  it("stamps extension wrapper modules as extension-owned contributions", () => {
    const shell = createShellCore();

    shell.registerModule({
      id: "extension.pstdio.extension-lab",
      source: "extension",
      activate(ctx) {
        ctx.commands.registerCommand({ id: "extension-lab.say-hello", label: "Say hello" }, { execute: () => null });
      },
    });

    expect(shell.commands.getCommand("extension-lab.say-hello")).toMatchObject({
      source: "extension",
      ownerId: "extension.pstdio.extension-lab",
    });
  });

  it("uses module metadata for mode-scoped contributions and disposes them with the mode", () => {
    const shell = createShellCore();

    shell.registerModule({
      id: "dashboard.modes",
      activate(ctx) {
        ctx.modes.registerMode({
          id: "project",
          activate(modeCtx) {
            modeCtx.commands.registerCommand(
              { id: "project.refresh", label: "Refresh project" },
              { execute: () => undefined },
            );
            modeCtx.trees.registerTreeView({
              id: "project.navigation",
              title: "Project",
              getRoots: () => [],
              getChildren: () => [],
            });
          },
        });
      },
    });

    shell.modes.setActiveMode("project");

    expect(shell.commands.getCommand("project.refresh")).toMatchObject({
      source: "module",
      ownerId: "dashboard.modes",
    });
    expect(shell.trees.getTreeView("project.navigation")).toMatchObject({
      source: "module",
      ownerId: "dashboard.modes",
    });

    shell.modes.setActiveMode(undefined);

    expect(shell.commands.getCommand("project.refresh")).toBeUndefined();
    expect(shell.trees.getTreeView("project.navigation")).toBeUndefined();
  });
});
