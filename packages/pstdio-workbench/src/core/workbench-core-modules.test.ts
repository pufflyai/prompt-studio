import { describe, expect, it } from "bun:test";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "./workbench-core";

describe("workbench modules", () => {
  it("registers a module through workbench resources, widgets, commands, menus, notifications, and trees", async () => {
    const workbench = createWorkbenchCore();
    const projectResource = {
      kind: "project",
      uri: "pstdio://project/project-1",
      id: "project-1",
      label: "Prompt Studio",
    };
    const module: WorkbenchModuleContribution = {
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
          ctx.layout.registerMenuItem(["commandPalette"], {
            commandId: "project.openSettings",
            label: "Open project settings",
          }),
          ctx.renderers.registerTreeRenderer({
            id: "project.navigation",
            title: "Project",
            getBody: () => [
              { id: "root", nodes: [{ id: "project-1", label: "Prompt Studio", resource: projectResource }] },
            ],
            getChildren: () => [],
          }),
        ];
      },
    };

    const disposable = workbench.registerModule(module);

    expect(workbench.resources.getKind("project")?.ownerId).toBe("dashboard.project");
    expect(workbench.resources.getKind("project")?.source).toBe("module");
    expect(workbench.layout.getWidget("project.settings")?.ownerId).toBe("dashboard.project");
    expect(workbench.commands.getCommand("project.openSettings")?.ownerId).toBe("dashboard.project");
    expect(workbench.layout.listMenuItems(["commandPalette"])[0]?.ownerId).toBe("dashboard.project");
    expect(workbench.notifications.listNotifications()[0]?.ownerId).toBe("dashboard.project");
    expect((await workbench.renderers.getBody("project.navigation"))[0]?.nodes[0]?.resource?.uri).toBe(
      projectResource.uri,
    );

    await workbench.commands.executeCommand("project.openSettings");

    expect(workbench.layout.getLayout().activeWidgetId).toBe("project.settings");
    expect(workbench.layout.getLayout().activeResourceUri).toBe(projectResource.uri);

    disposable.dispose();

    expect(workbench.commands.getCommand("project.openSettings")).toBeUndefined();
  });

  it("auto-tracks module registrations and unregisters them by module id", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "dashboard.project",
      activate(ctx) {
        ctx.resources.registerKind({ kind: "project", label: "Project" });
        ctx.commands.registerCommand({ id: "project.open", label: "Open project" }, { execute: () => undefined });
        ctx.keybindings.registerKeybinding({ commandId: "project.open", keybinding: "mod+shift+o" });
        ctx.layout.registerMenuItem(["commandPalette"], { commandId: "project.open" });
        ctx.theme.registerTheme({
          id: "project",
          tokens: {
            activityBarBackground: "#111827",
            sideBarBackground: "#102a2a",
            mainBackground: "#18181b",
            panelBackground: "#1f2937",
            statusBarBackground: "#0f172a",
            focusBorder: "#facc15",
            commandPaletteBackground: "#18181b",
          },
        });
      },
    });

    expect(workbench.resources.getKind("project")?.source).toBe("module");
    expect(workbench.commands.getCommand("project.open")?.ownerId).toBe("dashboard.project");
    expect(
      workbench.keybindings
        .listKeybindings()
        .some((keybinding) => keybinding.commandId === "project.open" && keybinding.ownerId === "dashboard.project"),
    ).toBe(true);
    expect(workbench.layout.listMenuItems(["commandPalette"])).toHaveLength(1);
    expect(workbench.theme.listThemes().map((theme) => theme.id)).toContain("project");

    workbench.unregisterModule("dashboard.project");

    expect(workbench.resources.getKind("project")).toBeUndefined();
    expect(workbench.commands.getCommand("project.open")).toBeUndefined();
    expect(workbench.keybindings.listKeybindings().map((keybinding) => keybinding.commandId)).not.toContain(
      "project.open",
    );
    expect(workbench.layout.listMenuItems(["commandPalette"])).toEqual([]);
    expect(workbench.theme.listThemes().map((theme) => theme.id)).not.toContain("project");
  });

  it("rejects duplicate module ids and keeps stale disposables from removing newer modules", () => {
    const workbench = createWorkbenchCore();
    const createModule = (label: string): WorkbenchModuleContribution => ({
      id: "dashboard.project",
      activate(ctx) {
        ctx.commands.registerCommand({ id: "project.open", label }, { execute: () => undefined });
      },
    });

    const first = workbench.registerModule(createModule("First"));

    expect(() => workbench.registerModule(createModule("Duplicate"))).toThrow(
      "Workbench module already registered: dashboard.project",
    );

    workbench.unregisterModule("dashboard.project");
    workbench.registerModule(createModule("Second"));
    first.dispose();

    expect(workbench.commands.getCommand("project.open")?.command.label).toBe("Second");
  });

  it("stamps extension wrapper modules as extension-owned contributions", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "extension.pstdio.extension-lab",
      source: "extension",
      activate(ctx) {
        ctx.commands.registerCommand({ id: "extension-lab.say-hello", label: "Say hello" }, { execute: () => null });
      },
    });

    expect(workbench.commands.getCommand("extension-lab.say-hello")).toMatchObject({
      source: "extension",
      ownerId: "extension.pstdio.extension-lab",
    });
  });

  it("cleans up module-owned context keys without removing global context", () => {
    const workbench = createWorkbenchCore();

    workbench.context.set("hostReady", true);
    const disposable = workbench.registerModule({
      id: "dashboard.project",
      activate(ctx) {
        ctx.context.set("projectVisible", true);
      },
    });

    expect(workbench.context.snapshot()).toMatchObject({
      hostReady: true,
      projectVisible: true,
    });

    disposable.dispose();

    expect(workbench.context.get("hostReady")).toBe(true);
    expect(workbench.context.get("projectVisible")).toBeUndefined();
  });

  it("uses module metadata for mode-scoped contributions and disposes them with the mode", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "dashboard.modes",
      activate(ctx) {
        ctx.modes.registerMode({
          id: "project",
          activate(modeCtx) {
            modeCtx.commands.registerCommand(
              { id: "project.refresh", label: "Refresh project" },
              { execute: () => undefined },
            );
            modeCtx.renderers.registerTreeRenderer({
              id: "project.navigation",
              title: "Project",
              getBody: () => [],
              getChildren: () => [],
            });
          },
        });
      },
    });

    workbench.modes.setActiveMode("project");

    expect(workbench.commands.getCommand("project.refresh")).toMatchObject({
      source: "module",
      ownerId: "dashboard.modes",
    });
    expect(workbench.renderers.getTreeRenderer("project.navigation")).toMatchObject({
      source: "module",
      ownerId: "dashboard.modes",
    });

    workbench.modes.setActiveMode(undefined);

    expect(workbench.commands.getCommand("project.refresh")).toBeUndefined();
    expect(workbench.renderers.getTreeRenderer("project.navigation")).toBeUndefined();
  });
});
