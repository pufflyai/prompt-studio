import { describe, expect, test } from "bun:test";
import { workbenchExtensionMetadataSchema } from "./extensions";

const webview = {
  entry: { kind: "package-asset" as const, path: "./src/settings.tsx", baseUrl: "file:///extension.ts" },
  runtimeUrl: "/v1/extensions/runtime",
  moduleUrl: "/v1/extensions/installed/lab/webviews/lab.settings/module.js",
};

describe("workbench extension metadata targets", () => {
  test("serializes targets, mode conditions, tree items, and settings scope", () => {
    const parsed = workbenchExtensionMetadataSchema.parse({
      extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "/extensions/lab" }],
      commands: [{ id: "lab.review", extensionId: "pstdio.lab", title: "Review" }],
      menuContributions: [
        {
          id: "lab.review.menu.0",
          extensionId: "pstdio.lab",
          commandId: "lab.review",
          slotId: "workspace.headerPrimary",
          target: "workbench.nav.actions",
          label: "Review",
          when: { mode: "workspace", resourceType: ["workspace"] },
        },
      ],
      treeItems: [
        {
          id: "lab.workspaceOnly",
          extensionId: "pstdio.lab",
          target: "workbench.left.tree",
          label: "Workspace only",
          action: { kind: "view", viewId: "workspace-lab" },
          when: { mode: "workspace" },
        },
      ],
      modes: [
        {
          id: "lab.mode",
          extensionId: "pstdio.lab",
          modeId: "pstdio.lab.mode",
          label: "Lab",
          panelRegions: ["main"],
          resources: {
            ticket: {
              slots: {
                primary: { region: "main", required: true },
                navigation: { region: "sidenav", required: true },
              },
            },
          },
        },
      ],
      panels: [
        {
          id: "lab.files",
          extensionId: "pstdio.lab",
          title: "Files",
          path: "files",
          show: { region: "main" },
          renderer: { kind: "tree", id: "lab.files" },
        },
      ],
      treeRenderers: [
        {
          id: "lab.files",
          extensionId: "pstdio.lab",
          title: "Files",
          icon: "Files",
          bodyHandlerId: "lab.files.body",
          childrenHandlerId: "lab.files.children",
          footerHandlerId: "lab.files.footer",
          defaultExpandedSectionIds: ["files"],
          defaultExpandedNodeIds: ["ticket"],
        },
      ],
      routes: [],
      settingsPanels: [
        {
          id: "lab.settings",
          extensionId: "pstdio.lab",
          slotId: "project.settingsPanels",
          target: "workbench.settings",
          scope: "project",
          title: "Lab settings",
          webview,
        },
      ],
      kanbanRenderers: [],
      diagnostics: [],
    });

    expect(parsed.menuContributions[0]).toMatchObject({
      target: "workbench.nav.actions",
      when: { mode: "workspace", resourceType: ["workspace"] },
    });
    expect(parsed.treeItems?.[0]).toMatchObject({
      target: "workbench.left.tree",
      when: { mode: "workspace" },
    });
    expect(parsed.modes[0]?.panelRegions).toEqual(["main"]);
    expect(parsed.modes[0]?.resources?.ticket?.slots?.primary).toEqual({ region: "main", required: true });
    expect(parsed.panels[0]).toMatchObject({
      path: "files",
      renderer: { kind: "tree", id: "lab.files" },
      show: { region: "main" },
    });
    expect(parsed.panels[0]).not.toHaveProperty("webview");
    expect(parsed.treeRenderers?.[0]).toMatchObject({
      id: "lab.files",
      bodyHandlerId: "lab.files.body",
      childrenHandlerId: "lab.files.children",
      footerHandlerId: "lab.files.footer",
    });
    expect(parsed.settingsPanels[0]).toMatchObject({
      target: "workbench.settings",
      scope: "project",
    });
  });

  test("rejects contribution targets that are too granular", () => {
    const result = workbenchExtensionMetadataSchema.safeParse({
      extensions: [],
      commands: [],
      menuContributions: [
        {
          id: "bad.menu",
          extensionId: "pstdio.bad",
          commandId: "bad.command",
          slotId: "project.headerPrimary",
          target: "workbench.nav.actions.icon",
          label: "Bad",
        },
      ],
      treeItems: [],
      treeRenderers: [],
      modes: [],
      panels: [],
      routes: [],
      settingsPanels: [],
      kanbanRenderers: [],
      diagnostics: [],
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown logical mode panels", () => {
    const result = workbenchExtensionMetadataSchema.safeParse({
      extensions: [],
      commands: [],
      menuContributions: [],
      treeItems: [],
      treeRenderers: [],
      modes: [
        {
          id: "bad.mode",
          extensionId: "pstdio.bad",
          modeId: "pstdio.bad.mode",
          label: "Bad",
          panelRegions: ["overlay"],
        },
      ],
      panels: [],
      routes: [],
      settingsPanels: [],
      kanbanRenderers: [],
      diagnostics: [],
    });

    expect(result.success).toBe(false);
  });

  test("rejects chrome regions in mode recipes", () => {
    const result = workbenchExtensionMetadataSchema.safeParse({
      extensions: [],
      commands: [],
      menuContributions: [],
      treeItems: [],
      treeRenderers: [],
      modes: [
        {
          id: "bad.mode",
          extensionId: "pstdio.bad",
          modeId: "pstdio.bad.mode",
          label: "Bad",
          resources: { ticket: { slots: { primary: { region: "overlay" } } } },
        },
      ],
      panels: [],
      routes: [],
      settingsPanels: [],
      kanbanRenderers: [],
      diagnostics: [],
    });

    expect(result.success).toBe(false);
  });
});
