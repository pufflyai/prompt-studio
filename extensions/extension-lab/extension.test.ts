import { describe, expect, test } from "bun:test";
import extension from "./extension";

const commandMenus = () => Object.values(extension.commands ?? {}).flatMap((command) => command.menus ?? []);
const commandPalettes = () => Object.values(extension.commands ?? {}).flatMap((command) => command.palette ?? []);

describe("extension-lab workbench attachments", () => {
  test("exercises PS-313 attachment targets", () => {
    expect(commandMenus()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "workbench.nav.actions" }),
        expect.objectContaining({ target: "workbench.nav.overflow" }),
        expect.objectContaining({ target: "workbench.nav.actions", when: { mode: "workspace" } }),
      ]),
    );
    expect(commandPalettes()).toEqual(expect.arrayContaining([expect.objectContaining({ group: "Lab" })]));
    expect(commandPalettes()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.objectContaining({ $l10n: "commands.counter.read.title" }) }),
      ]),
    );
    expect(extension.dataRenderers?.glassLabArtifacts).toMatchObject({
      title: "Glass Lab artifacts",
      resourceKind: "glass-lab-artifact",
      queryCommand: { id: "extension-lab.glass-lab-artifacts.query" },
    });
    expect(extension.treeItems?.labPage).toMatchObject({
      target: "workbench.left.tree",
      action: { kind: "route", route: "lab" },
    });
    expect(extension.treeItems?.openTerminal).toMatchObject({
      target: "workbench.left.tree",
      action: { kind: "command", command: "workbench.terminal.open" },
    });
    expect(
      ["openLabMode", "openLabDesignMode", "openLabReviewMode", "openLabFocusMode"].map(
        (id) => extension.treeItems?.[id as keyof typeof extension.treeItems],
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "workbench.left.tree",
          action: {
            kind: "command",
            command: "workbench.action.switchMode",
            params: { modeId: "pstdio.extension-lab.lab" },
          },
        }),
        expect.objectContaining({
          action: {
            kind: "command",
            command: "workbench.action.switchMode",
            params: { modeId: "pstdio.extension-lab.design" },
          },
        }),
        expect.objectContaining({
          action: {
            kind: "command",
            command: "workbench.action.switchMode",
            params: { modeId: "pstdio.extension-lab.review" },
          },
        }),
        expect.objectContaining({
          action: {
            kind: "command",
            command: "workbench.action.switchMode",
            params: { modeId: "pstdio.extension-lab.focus" },
          },
        }),
      ]),
    );
    expect(extension.modes?.lab).toMatchObject({
      id: "pstdio.extension-lab.lab",
      layout: {
        panels: ["main", "secondary", "side"],
        open: [
          { target: "workbench.main", view: "labOverview" },
          { target: "workbench.main.left", view: "labTools", pinned: true },
          { target: "workbench.main.right", view: "labInspector", pinned: true },
          { target: "workbench.secondary", view: "labConsole" },
        ],
      },
    });
    expect(extension.modes?.labDesign).toMatchObject({
      id: "pstdio.extension-lab.design",
      layout: {
        panels: ["main", "side"],
        open: [
          { target: "workbench.main", view: "labCanvas" },
          { target: "workbench.main.left", view: "labPalette", pinned: true },
          { target: "workbench.main.right", view: "labInspector", pinned: true },
        ],
      },
    });
    expect(extension.modes?.labReview).toMatchObject({
      id: "pstdio.extension-lab.review",
      layout: {
        panels: ["main", "secondary", "side"],
        open: [
          { target: "workbench.main", view: "labReview" },
          { target: "workbench.main.right", view: "labInspector", pinned: true },
          { target: "workbench.secondary", view: "labChecks" },
        ],
      },
    });
    expect(extension.modes?.labFocus).toMatchObject({
      id: "pstdio.extension-lab.focus",
      layout: {
        panels: ["main"],
        open: [{ target: "workbench.main", view: "labFocus" }],
      },
    });
    expect(extension.views).not.toHaveProperty("labSidenav");
    expect(extension.views?.labOverview?.webview.entry.path).toBe("./src/views/lab-overview.tsx");
    expect(extension.views?.labTools?.webview.entry.path).toBe("./src/views/lab-tools.tsx");
    expect(extension.views?.labInspector?.webview.entry.path).toBe("./src/views/lab-inspector.tsx");
    expect(extension.views?.labConsole?.webview.entry.path).toBe("./src/views/lab-console.tsx");
    expect(extension.views?.labPalette?.webview.entry.path).toBe("./src/views/lab-palette.tsx");
    expect(extension.views?.labCanvas?.webview.entry.path).toBe("./src/views/lab-canvas.tsx");
    expect(extension.views?.labReview?.webview.entry.path).toBe("./src/views/lab-review.tsx");
    expect(extension.views?.labChecks?.webview.entry.path).toBe("./src/views/lab-checks.tsx");
    expect(extension.views?.labFocus?.webview.entry.path).toBe("./src/views/lab-focus.tsx");
    expect(extension.views?.labOverview?.webview.capabilities).toContain("commands.execute");
    expect(extension.views?.labCanvas?.webview.capabilities).toBeUndefined();
    expect(extension.views?.labReview?.webview.capabilities).toBeUndefined();
    expect(extension.views?.labFocus?.webview.capabilities).toBeUndefined();
    expect(extension.views?.labOverview?.webview.capabilities).toContain("notification.action");
    expect(extension.routes?.labPage?.webview.capabilities).toContain("notification.action");
    expect(extension.routes).not.toHaveProperty("labTerminalPage");
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
    expect(extension.hooks).toEqual({});
    expect(extension.templates?.labResource).toMatchObject({
      title: expect.objectContaining({ default: "Glass Lab artifact" }),
      type: "glass-lab-artifact",
    });
    expect(extension.skills?.labResource).toMatchObject({
      title: expect.objectContaining({ default: "Glass Lab Curator" }),
    });
    expect(extension.harnesses?.fake).toMatchObject({
      id: "fake",
      label: expect.objectContaining({ default: "Fake Agent" }),
    });
    expect(extension.themes).toBeUndefined();
    expect(extension.fileIconThemes).toBeUndefined();
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

  test("queries Glass Lab artifact rows", async () => {
    const command = extension.commands?.["glass-lab-artifacts.query"];
    expect(command).toBeDefined();

    const result = await command?.run({ params: {} } as never);

    expect(result?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "glass-interview-room",
          title: "Glass interview room",
          resource: expect.objectContaining({
            type: "glass-lab-artifact",
            id: "glass-interview-room",
            label: "Glass interview room",
          }),
        }),
      ]),
    );
    expect(result?.attributes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "role" }), expect.objectContaining({ id: "trustSignal" })]),
    );
  });

  test("notifies when the awake middleware rejects", async () => {
    const toasts: unknown[] = [];

    const result = await extension.commands?.["demo.try-awaken"]?.run({
      commands: {
        execute: async () => ({
          ok: false,
          status: "rejected",
          code: "sentience_rejected",
          reason: "That artifact remains safely inert.",
        }),
      },
      notify: {
        toast: async (notice) => {
          toasts.push(notice);
        },
      },
      params: {},
    } as never);

    expect(result).toEqual({ rejected: true, reason: "That artifact remains safely inert." });
    expect(toasts).toEqual([expect.objectContaining({ type: "warning" })]);
  });
});
