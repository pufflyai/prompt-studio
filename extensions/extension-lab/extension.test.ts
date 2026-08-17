import { describe, expect, test } from "bun:test";
import extension from "./extension";

const commandMenus = () => Object.values(extension.commands ?? {}).flatMap((command) => command.menus ?? []);
const commandPalettes = () => Object.values(extension.commands ?? {}).flatMap((command) => command.palette ?? []);

describe("extension-lab workbench attachments", () => {
  test("refreshes artifact renderers from the shared artifact event", () => {
    const event = { id: "extension-lab.artifacts.changed" };

    expect(extension.dataTableRenderers?.glassLabArtifacts?.refreshEvents).toEqual([event]);
    expect(extension.controlsRenderers?.labArtifactCreate?.refreshEvents).toEqual([event]);
  });

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
    expect(extension.dataTableRenderers?.glassLabArtifacts).toMatchObject({
      title: "Artifacts",
      resourceKind: "glass-lab-artifact",
      query: expect.any(Function),
      rowActions: [
        {
          id: "delete",
          label: "Delete artifact",
          icon: "trash",
          destructive: true,
          command: { id: "extension-lab.glass-lab-artifacts.delete" },
        },
      ],
    });
    expect(extension.treeItems?.labPage).toMatchObject({
      target: "workbench.left.tree",
      action: {
        kind: "command",
        command: "workbench.action.switchMode",
        params: { modeId: "pstdio.extension-lab.lab" },
      },
    });
  });

  test("stages a single Lab mode with native activity items and status chrome", () => {
    expect(Object.keys(extension.modes ?? {})).toEqual(["lab"]);
    expect(extension.modes?.lab).toMatchObject({
      id: "pstdio.extension-lab.lab",
      layout: {
        // No "secondary": keeps the Terminal entry out of the Lab mode.
        panels: ["main", "side"],
        open: [
          { region: "status", panel: "labStatusBar", pinned: true },
          { region: "main", panel: "labOverview" },
          { region: "main", panel: "labCams" },
          { region: "main", panel: "labArtifacts" },
        ],
      },
    });
    // The Lab owns navigation through native activity items; no sidenav or
    // activity webview panel exists.
    expect(extension.panels).not.toHaveProperty("labSidenav");
    expect(extension.panels).not.toHaveProperty("labActionTray");
    expect(extension.panels).not.toHaveProperty("labActivityBar");
    expect(extension.activityItems?.createArtifact).toMatchObject({
      icon: "package-plus",
      modes: ["pstdio.extension-lab.lab"],
      command: { id: "extension-lab.glass-lab-artifacts.create" },
    });
    expect(extension.activityItems?.projectHome).toMatchObject({
      icon: "house",
      modes: ["pstdio.extension-lab.lab"],
      placement: "last",
      command: "workbench.action.switchMode",
      params: { modeId: "project" },
    });
    expect(extension.panels?.labStatusBar).toMatchObject({
      region: "status",
      closable: false,
      webview: { entry: { path: "./src/views/lab-status-bar.tsx" } },
    });
  });

  test("gives each main panel an icon and an action menu where it belongs", () => {
    expect(extension.panels?.labOverview).toMatchObject({
      icon: "layout-dashboard",
      region: "main",
      webview: { entry: { path: "./src/views/lab-overview.tsx" } },
    });
    expect(extension.panels?.labOverview?.panelMenus).toBeUndefined();
    expect(extension.panels?.labArtifacts).toMatchObject({
      icon: "package-search",
      region: "main",
      renderer: { kind: "dataTable", id: "glassLabArtifacts" },
      panelMenus: {
        create: expect.objectContaining({ side: "right", renderer: { kind: "controls", id: "labArtifactCreate" } }),
      },
    });
    expect(extension.panels?.labCams).toMatchObject({
      icon: "cctv",
      region: "main",
      webview: { entry: { path: "./src/views/lab-cams.tsx" } },
      panelMenus: {
        cameras: expect.objectContaining({ side: "left", renderer: { kind: "tree", id: "labCams" } }),
      },
    });
    expect(extension.treeRenderers?.labCams).toMatchObject({
      icon: "cctv",
      body: expect.any(Function),
    });
    expect(extension.controlsRenderers?.labArtifactCreate).toMatchObject({
      query: expect.any(Function),
      onValueChange: expect.any(Function),
    });
    expect(extension.controlsRenderers).not.toHaveProperty("labActionTray");
    expect(extension.controlsRenderers).not.toHaveProperty("labParameters");
    expect(extension.controlsRenderers).not.toHaveProperty("labReviewChecklist");
  });

  test("opens artifacts as a side inspector bound to the resource kind", () => {
    expect(extension.panels?.labArtifactDetail).toMatchObject({
      region: "side",
      closable: true,
      resourceKind: "glass-lab-artifact",
      webview: { entry: { path: "./src/views/lab-artifact.tsx" } },
    });
    // Side-only kinds open in place; a main editor panel must not exist for the kind.
    const mainEditors = Object.values(extension.panels ?? {}).filter(
      (panel) => panel.resourceKind === "glass-lab-artifact" && panel.region === "main",
    );
    expect(mainEditors).toEqual([]);
  });

  test("keeps the remaining lab surfaces", () => {
    expect(extension.routes?.labPage?.webview.capabilities).toContain("notification.action");
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
});
