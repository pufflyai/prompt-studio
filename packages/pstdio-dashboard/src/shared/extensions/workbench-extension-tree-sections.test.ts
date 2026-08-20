import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { extensionLabMetadata as metadata } from "./workbench-extension-metadata.fixture";
import { buildDashboardExtensionTreeSections } from "./workbench-extension-tree-sections";

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

  test("renders a group-null tree item in a headerless root section", () => {
    const rootMetadata = {
      ...metadata,
      panels: [
        {
          id: "pstdio-planner.tickets",
          extensionId: "pstdio.planner",
          title: "Tickets",
          supportedRegions: ["main"],
          renderer: { kind: "kanban", id: "pstdio-planner.tickets" },
        },
      ],
      treeItems: [
        {
          id: "pstdio-planner.tickets",
          extensionId: "pstdio.planner",
          target: "workbench.left.tree",
          label: "Tickets",
          icon: "square-kanban",
          group: null,
          placement: "first",
          action: { kind: "panel", panelId: "pstdio-planner.tickets" },
        },
      ],
    } satisfies DashboardExtensionMetadata;

    const sections = buildDashboardExtensionTreeSections({
      metadata: rootMetadata,
      modeId: "project",
      placement: "first",
      projectId: "project-1",
      target: "workbench.left.tree",
    });

    expect(sections).toEqual([
      {
        id: "extension-tree-group:workbench.left.tree:first:__root__",
        collapsible: false,
        nodes: [
          expect.objectContaining({
            id: "dashboard-workbench://project/project-1/extension-views/pstdio-planner.tickets",
            label: "Tickets",
          }),
        ],
      },
    ]);
    expect(sections[0]).not.toHaveProperty("label");
  });

  test("maps a resource action onto the browse-root resource the tree item opens", () => {
    const browseRootMetadata = {
      ...metadata,
      treeItems: [
        {
          id: "pstdio-planner.ticketsRoot",
          extensionId: "pstdio.planner",
          target: "workbench.left.tree",
          label: "Tickets",
          icon: "square-kanban",
          group: null,
          action: {
            kind: "resource",
            resource: { type: "extension-view", id: "pstdio-planner.tickets" },
          },
        },
        {
          id: "pstdio-planner.pinnedTicket",
          extensionId: "pstdio.planner",
          target: "workbench.left.tree",
          label: "PS-1 Pinned",
          icon: "FileText",
          action: {
            kind: "resource",
            resource: { type: "ticket", id: "PS-1", label: "PS-1 Pinned", metadata: { shorthand: "PS-1" } },
          },
        },
      ],
    } satisfies DashboardExtensionMetadata;

    const sections = buildDashboardExtensionTreeSections({
      metadata: browseRootMetadata,
      modeId: "project",
      projectId: "project-1",
      target: "workbench.left.tree",
    });
    const nodes = sections.flatMap((section) => section.nodes);

    // The browse root keeps the canonical extension panel URI, so hierarchy
    // parents, sidenav selection, and the tree item all share one identity.
    expect(nodes[0]).toEqual(
      expect.objectContaining({
        id: "dashboard-workbench://project/project-1/extension-views/pstdio-planner.tickets",
        label: "Tickets",
        icon: "square-kanban",
        resource: expect.objectContaining({
          kind: "extension-view",
          uri: "dashboard-workbench://project/project-1/extension-views/pstdio-planner.tickets",
          id: "pstdio-planner.tickets",
          metadata: expect.objectContaining({ extensionId: "pstdio.planner", projectId: "project-1" }),
        }),
      }),
    );
    expect(nodes[1]).toEqual(
      expect.objectContaining({
        label: "PS-1 Pinned",
        resource: expect.objectContaining({
          kind: "ticket",
          uri: "dashboard-workbench://ticket/PS-1",
          id: "PS-1",
          metadata: expect.objectContaining({ shorthand: "PS-1", projectId: "project-1" }),
        }),
      }),
    );
  });
});

describe("root tree placement", () => {
  test("renders a group-null tree item as a headerless root section", () => {
    const sections = buildDashboardExtensionTreeSections({
      metadata: {
        ...metadata,
        treeItems: [
          {
            id: "pstdio-planner.tickets",
            extensionId: "pstdio.pstdio-planner",
            target: "workbench.left.tree",
            group: null,
            label: "Tickets",
            action: { kind: "command", commandId: "extension-lab.say-hello" },
            icon: "square-kanban",
          },
        ],
      },
      modeId: "project",
      projectId: "project-1",
      target: "workbench.left.tree",
    });

    expect(sections).toEqual([
      {
        id: "extension-tree-group:workbench.left.tree:default:__root__",
        collapsible: false,
        nodes: [expect.objectContaining({ label: "Tickets" })],
      },
    ]);
  });

  test("keeps the default group when group is undefined", () => {
    const sections = buildDashboardExtensionTreeSections({
      metadata: {
        ...metadata,
        treeItems: [
          {
            id: "pstdio-planner.tickets",
            extensionId: "pstdio.pstdio-planner",
            target: "workbench.left.tree",
            label: "Tickets",
            action: { kind: "command", commandId: "extension-lab.say-hello" },
          },
        ],
      },
      modeId: "project",
      projectId: "project-1",
      target: "workbench.left.tree",
    });

    expect(sections.map((section) => section.label)).toEqual(["Extensions"]);
  });
});
