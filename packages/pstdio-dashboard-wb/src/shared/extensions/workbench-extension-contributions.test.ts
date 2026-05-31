import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { workbenchCommandPaletteMenuPath, workbenchTopHeaderTrailingMenuPath } from "pstdio-workbench/core";
import {
  buildDashboardExtensionMenuRegistrations,
  buildDashboardExtensionRouteEntries,
  buildDashboardExtensionTreeSections,
} from "./workbench-extension-contributions";

const metadata = {
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [
    { id: "extension-lab.say-hello", extensionId: "pstdio.extension-lab", title: "Say hello" },
    { id: "extension-lab.counter.bump", extensionId: "pstdio.extension-lab", title: "Bump lab counter" },
    { id: "extension-lab.run-review", extensionId: "pstdio.extension-lab", title: "Run review" },
  ],
  diagnostics: [],
  menuContributions: [
    {
      id: "extension-lab.say-hello.header",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.say-hello",
      slotId: "project.headerPrimary",
      label: "Lab: Say hello",
      icon: "flask-conical",
      when: {
        resourceType: ["extension-route"],
        metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
      },
    },
    {
      id: "extension-lab.counter.bump.header",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.counter.bump",
      slotId: "project.headerOverflow",
      label: "Bump lab counter",
      icon: "plus",
      when: {
        resourceType: ["extension-route"],
        metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
      },
    },
    {
      id: "extension-lab.say-hello.palette",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.say-hello",
      slotId: "project.commandPanel",
      label: "Say hello",
      group: "Lab",
    },
    {
      id: "extension-lab.run-review.header",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.run-review",
      slotId: "workspace.headerPrimary",
      label: "Run review",
    },
  ],
  navigation: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      slotId: "legacy.projectSidebarNav",
      group: "Lab",
      label: "Lab",
      route: "lab",
      icon: "flask-conical",
    },
    {
      id: "extension-lab.outsideProject",
      extensionId: "pstdio.extension-lab",
      slotId: "legacy.workspaceTabs",
      label: "Workspace lab",
      route: "workspace-lab",
    },
  ],
  treeItems: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      target: "workbench.left.tree",
      group: "Lab",
      label: "Lab",
      action: { kind: "route", route: "lab" },
      icon: "flask-conical",
      when: { mode: "project" },
    },
  ],
  routes: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      path: "lab",
      label: "Lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labPage/module.js",
      },
    },
  ],
  modes: [],
  settingsPanels: [],
  views: [],
} satisfies DashboardExtensionMetadata;

const labRouteWhenExpression = [
  'dashboard.activeResource.kind == "extension-route"',
  'dashboard.activeResource.metadata.extensionId == "pstdio.extension-lab"',
  'dashboard.activeResource.metadata.routePath == "lab"',
].join(" && ");

describe("dashboard workbench extension tree contributions", () => {
  test("maps project tree item records into extension-defined groups", () => {
    const sections = buildDashboardExtensionTreeSections({
      metadata,
      modeId: "project",
      projectId: "project-1",
      target: "workbench.left.tree",
    });

    expect(sections).toEqual([
      {
        id: "extension-tree-group:workbench.left.tree:default:Lab",
        label: "Lab",
        collapsible: false,
        nodes: [
          expect.objectContaining({
            id: "dashboard-workbench://project/project-1/extensions/lab",
            label: "Lab",
            icon: "flask-conical",
            resource: expect.objectContaining({
              kind: "extension-route",
              uri: "dashboard-workbench://project/project-1/extensions/lab",
              id: "lab",
              label: "Lab",
              metadata: expect.objectContaining({
                extensionId: "pstdio.extension-lab",
                routePath: "lab",
                route: metadata.routes[0],
              }),
            }),
          }),
        ],
      },
    ]);
  });

  test("uses unique section ids for first and default groups with the same label", () => {
    const sameGroupMetadata = {
      ...metadata,
      treeItems: [
        {
          id: "extension-lab.first",
          extensionId: "pstdio.extension-lab",
          target: "workbench.left.tree",
          group: "Extensions",
          label: "First",
          placement: "first",
          action: { kind: "command", commandId: "extension-lab.say-hello" },
        },
        {
          id: "extension-lab.default",
          extensionId: "pstdio.extension-lab",
          target: "workbench.left.tree",
          group: "Extensions",
          label: "Default",
          action: { kind: "command", commandId: "extension-lab.say-hello" },
        },
      ],
    } satisfies DashboardExtensionMetadata;
    const firstSections = buildDashboardExtensionTreeSections({
      metadata: sameGroupMetadata,
      modeId: "project",
      placement: "first",
      projectId: "project-1",
      target: "workbench.left.tree",
    });
    const defaultSections = buildDashboardExtensionTreeSections({
      metadata: sameGroupMetadata,
      modeId: "project",
      projectId: "project-1",
      target: "workbench.left.tree",
    });

    const sectionIds = [...firstSections, ...defaultSections].map((section) => section.id);

    expect(sectionIds).toEqual([
      "extension-tree-group:workbench.left.tree:first:Extensions",
      "extension-tree-group:workbench.left.tree:default:Extensions",
    ]);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  });

  test("lists extension route entries without legacy navigation grouping", () => {
    const entries = buildDashboardExtensionRouteEntries({ metadata, projectId: "project-1" });

    expect(entries).toEqual([
      expect.objectContaining({
        resource: expect.objectContaining({ uri: "dashboard-workbench://project/project-1/extensions/lab" }),
      }),
    ]);
    expect(entries[0]).not.toHaveProperty("group");
  });

  test("maps extension route header actions to the top header with route context", () => {
    const registrations = buildDashboardExtensionMenuRegistrations(metadata);
    const headerRegistrations = registrations.filter(
      (registration) =>
        registration.contribution.id.endsWith(".header") && registration.contribution.slotId.startsWith("project."),
    );
    const paletteRegistration = registrations.find(
      (registration) => registration.contribution.id === "extension-lab.say-hello.palette",
    );

    expect(headerRegistrations).toEqual([
      expect.objectContaining({
        menuPath: workbenchTopHeaderTrailingMenuPath,
        menuItem: expect.objectContaining({
          commandId: "dashboard.extension.menu.extension-lab.say-hello.header",
          group: "primary",
          when: labRouteWhenExpression,
        }),
      }),
      expect.objectContaining({
        menuPath: workbenchTopHeaderTrailingMenuPath,
        menuItem: expect.objectContaining({
          commandId: "dashboard.extension.menu.extension-lab.counter.bump.header",
          group: "overflow",
          overflowLabel: "Extension actions",
          when: labRouteWhenExpression,
        }),
      }),
    ]);
    expect(paletteRegistration).toEqual(expect.objectContaining({ menuPath: workbenchCommandPaletteMenuPath }));
  });

  test("maps workspace header actions only when the active resource is a workspace", () => {
    const registrations = buildDashboardExtensionMenuRegistrations(metadata);
    const workspaceRegistration = registrations.find(
      (registration) => registration.contribution.id === "extension-lab.run-review.header",
    );

    expect(workspaceRegistration).toEqual(
      expect.objectContaining({
        menuPath: workbenchTopHeaderTrailingMenuPath,
        menuItem: expect.objectContaining({
          commandId: "dashboard.extension.menu.extension-lab.run-review.header",
          group: "primary",
          when: 'dashboard.activeResource.kind == "workspace"',
        }),
      }),
    );
  });
});
