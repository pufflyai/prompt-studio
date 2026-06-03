import { describe, expect, test } from "bun:test";
import extension from "./extension";

const commandMenus = () => Object.values(extension.commands ?? {}).flatMap((command) => command.menus ?? []);

describe("extension-lab workbench attachments", () => {
  test("exercises PS-313 attachment targets", () => {
    expect(commandMenus()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "workbench.nav.actions" }),
        expect.objectContaining({ target: "workbench.nav.overflow" }),
        expect.objectContaining({ target: "workbench.commandPalette" }),
        expect.objectContaining({ target: "workbench.nav.actions", when: { mode: "workspace" } }),
      ]),
    );
    expect(extension.treeItems?.labPage).toMatchObject({
      target: "workbench.left.tree",
      action: { kind: "route", route: "lab" },
    });
    expect(extension.treeItems?.openLabMode).toMatchObject({
      target: "workbench.left.tree",
      action: {
        kind: "command",
        command: "workbench.action.switchMode",
        params: { modeId: "pstdio.extension-lab.lab" },
      },
    });
    expect(extension.modes?.lab).toMatchObject({
      id: "pstdio.extension-lab.lab",
      layout: {
        reset: true,
        open: [
          { target: "workbench.left", view: "labSidebar", pinned: true },
          { target: "workbench.main", view: "labOverview" },
        ],
      },
    });
    expect(extension.modes?.labFocus).toMatchObject({
      layout: {
        reset: ["workbench.main"],
      },
    });
    expect(extension.views?.labSidebar?.webview.entry.path).toBe("./src/views/lab-sidebar.tsx");
    expect(extension.views?.labOverview?.webview.entry.path).toBe("./src/views/lab-overview.tsx");
    expect(extension.settings?.properties["counter.step"]).toMatchObject({
      type: "number",
      scope: "project",
      default: 1,
    });
    expect(extension.settings?.properties["greeting.tone"]).toMatchObject({
      type: "string",
      scope: "global",
      enum: ["friendly", "formal"],
    });
    expect(extension.settingsPanels?.projectPanel).toMatchObject({
      target: "workbench.settings",
      scope: "project",
      webview: { entry: { path: "./src/views/settings-project.tsx" } },
    });
    expect(extension.settingsPanels?.globalPanel).toMatchObject({
      target: "workbench.settings",
      scope: "global",
      webview: { entry: { path: "./src/views/settings-global.tsx" } },
    });
  });

  test("reads command invocation attachment context", async () => {
    const result = await extension.commands?.["say-hello"]?.run({
      attachment: {
        target: "workbench.nav.actions",
        mode: "workspace",
        projectId: "project-1",
        resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
      },
      notify: { toast: async () => {} },
      params: {},
      projectId: "project-1",
      settings: {
        get: async (key: string) => {
          if (key === "model.default") return "claude-sonnet-4";
          if (key === "greeting.tone") return "friendly";
          return undefined;
        },
      },
    } as never);

    expect(result).toMatchObject({
      attachment: {
        target: "workbench.nav.actions",
        mode: "workspace",
        resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
      },
      message: "hello dispatched",
      model: "claude-sonnet-4",
      tone: "friendly",
    });
  });
});
