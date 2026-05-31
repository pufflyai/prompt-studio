import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { workbenchTopHeaderTrailingMenuPath } from "pstdio-workbench/core";
import {
  buildDashboardExtensionMenuRegistrations,
  buildDashboardExtensionTreeSections,
} from "./workbench-extension-contributions";

const metadata = {
  extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "/extensions/lab" }],
  commands: [{ id: "lab.review", extensionId: "pstdio.lab", title: "Review" }],
  diagnostics: [],
  menuContributions: [
    {
      id: "lab.review.menu.0",
      extensionId: "pstdio.lab",
      commandId: "lab.review",
      target: "workbench.top.actions",
      slotId: "workspace.headerPrimary",
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
      group: "Lab",
      icon: "Layers",
      action: { kind: "route", route: "workspace-lab" },
      when: { mode: "workspace" },
    },
    {
      id: "lab.projectOnly",
      extensionId: "pstdio.lab",
      target: "workbench.left.tree",
      label: "Project only",
      group: "Lab",
      action: { kind: "route", route: "project-lab" },
      when: { mode: "project" },
    },
  ],
  navigation: [],
  routes: [
    {
      id: "lab.workspaceOnly",
      extensionId: "pstdio.lab",
      path: "workspace-lab",
      label: "Workspace lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/workspace.tsx", baseUrl: "file:///extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/lab/webviews/lab.workspaceOnly/module.js",
      },
    },
    {
      id: "lab.projectOnly",
      extensionId: "pstdio.lab",
      path: "project-lab",
      label: "Project lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/project.tsx", baseUrl: "file:///extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/lab/webviews/lab.projectOnly/module.js",
      },
    },
  ],
  modes: [],
  settingsPanels: [],
  views: [],
} satisfies DashboardExtensionMetadata;

describe("dashboard workbench extension attachments", () => {
  test("maps menu targets to host-owned top surfaces with mode and resource gates", () => {
    const registrations = buildDashboardExtensionMenuRegistrations(metadata);

    expect(registrations[0]).toEqual(
      expect.objectContaining({
        menuPath: workbenchTopHeaderTrailingMenuPath,
        menuItem: expect.objectContaining({
          commandId: "dashboard.extension.menu.lab.review.menu.0",
          group: "primary",
          when: 'activeWorkbenchMode == "workspace" && dashboard.activeResource.kind == "workspace"',
        }),
      }),
    );
  });

  test("filters left tree attachments by active mode", () => {
    const workspaceSections = buildDashboardExtensionTreeSections({
      metadata,
      modeId: "workspace",
      projectId: "project-1",
      target: "workbench.left.tree",
    });
    const projectSections = buildDashboardExtensionTreeSections({
      metadata,
      modeId: "project",
      projectId: "project-1",
      target: "workbench.left.tree",
    });

    expect(workspaceSections).toEqual([
      expect.objectContaining({
        id: "extension-tree-group:workbench.left.tree:default:Lab",
        nodes: [expect.objectContaining({ label: "Workspace only", icon: "Layers" })],
      }),
    ]);
    expect(projectSections).toEqual([
      expect.objectContaining({
        id: "extension-tree-group:workbench.left.tree:default:Lab",
        nodes: [expect.objectContaining({ label: "Project only" })],
      }),
    ]);
  });
});
