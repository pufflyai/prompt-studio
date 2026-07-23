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
          action: { kind: "route", route: "workspace-lab" },
          when: { mode: "workspace" },
        },
      ],
      modes: [
        {
          id: "lab.mode",
          extensionId: "pstdio.lab",
          modeId: "pstdio.lab.mode",
          label: "Lab",
          resourceKind: "ticket",
          layout: {
            panels: ["main"],
            open: [
              { target: "workbench.left", view: "lab.sidenav", pinned: true },
              { target: "workbench.main", view: "lab.overview" },
            ],
          },
        },
      ],
      views: [
        {
          id: "lab.files",
          extensionId: "pstdio.lab",
          slotId: "workbench.main.left",
          target: "workbench.main.left",
          title: "Files",
          role: "panel-menu",
          resourceKind: "ticket",
          treeRendererId: "lab.files",
          hostTreeHeader: "default",
          hostTreeFooter: "none",
        },
      ],
      treeRenderers: [
        {
          id: "lab.files",
          extensionId: "pstdio.lab",
          title: "Files",
          icon: "Files",
          bodyCommandId: "lab.files.body",
          childrenCommandId: "lab.files.children",
          footerCommandId: "lab.files.footer",
          defaultExpandedSectionIds: ["files"],
          defaultExpandedNodeIds: ["ticket"],
        },
      ],
      routes: [],
      navigation: [],
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
      dataRenderers: [],
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
    expect(parsed.modes[0]?.layout).toEqual({
      panels: ["main"],
      open: [
        { target: "workbench.left", view: "lab.sidenav", pinned: true },
        { target: "workbench.main", view: "lab.overview" },
      ],
    });
    expect(parsed.modes[0]?.resourceKind).toBe("ticket");
    expect(parsed.views[0]).toMatchObject({
      treeRendererId: "lab.files",
      resourceKind: "ticket",
      hostTreeHeader: "default",
      hostTreeFooter: "none",
    });
    expect(parsed.views[0]).not.toHaveProperty("webview");
    expect(parsed.treeRenderers?.[0]).toMatchObject({
      id: "lab.files",
      bodyCommandId: "lab.files.body",
      childrenCommandId: "lab.files.children",
      footerCommandId: "lab.files.footer",
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
      views: [],
      routes: [],
      navigation: [],
      settingsPanels: [],
      dataRenderers: [],
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
          layout: {
            panels: ["overlay"],
          },
        },
      ],
      views: [],
      routes: [],
      navigation: [],
      settingsPanels: [],
      dataRenderers: [],
      diagnostics: [],
    });

    expect(result.success).toBe(false);
  });

  test("rejects non-string mode resource kinds", () => {
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
          resourceKind: ["ticket"],
        },
      ],
      views: [],
      routes: [],
      navigation: [],
      settingsPanels: [],
      dataRenderers: [],
      diagnostics: [],
    });

    expect(result.success).toBe(false);
  });
});
