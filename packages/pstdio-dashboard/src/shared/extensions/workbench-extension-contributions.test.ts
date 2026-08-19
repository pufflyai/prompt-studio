import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { resourceContextMenuPath, workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
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
      slotId: "legacy.projectSidenavNav",
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
  panels: [],
} satisfies DashboardExtensionMetadata;

const labRouteWhenExpression = [
  'workbench.resource.kind == "extension-route"',
  'workbench.resource.metadata.extensionId == "pstdio.extension-lab"',
  'workbench.resource.metadata.routePath == "lab"',
].join(" && ");
const workspaceResourceContextMenuPath = resourceContextMenuPath("workspace");
const extensionRouteResourceContextMenuPath = resourceContextMenuPath("extension-route");
const ticketResourceContextMenuPath = resourceContextMenuPath("ticket");

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
});

describe("dashboard workbench extension menu contributions", () => {
  test("maps extension route actions beside the resource with route context", () => {
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
        menuItems: [
          expect.objectContaining({
            menuPath: extensionRouteResourceContextMenuPath,
            menuItem: expect.objectContaining({
              commandId: "dashboard.extension.menu.extension-lab.say-hello.header",
              group: "primary",
              when: labRouteWhenExpression,
            }),
          }),
        ],
      }),
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: extensionRouteResourceContextMenuPath,
            menuItem: expect.objectContaining({
              commandId: "dashboard.extension.menu.extension-lab.counter.bump.header",
              group: "overflow",
              overflowLabel: "Extension actions",
              when: labRouteWhenExpression,
            }),
          }),
        ],
      }),
    ]);
    expect(paletteRegistration?.menuItems).toEqual([
      expect.objectContaining({ menuPath: workbenchCommandPaletteMenuPath }),
    ]);
  });

  test("keeps resource-scoped modern targets beside their resource", () => {
    const registrations = buildDashboardExtensionMenuRegistrations({
      ...metadata,
      menuContributions: [
        {
          id: "extension-lab.say-hello.menu.0",
          extensionId: "pstdio.extension-lab",
          commandId: "extension-lab.say-hello",
          slotId: "project.headerPrimary",
          target: "workbench.nav.actions",
          label: "Lab: Say hello",
          icon: "flask-conical",
          when: {
            resourceType: ["extension-route"],
            metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
          },
        },
        {
          id: "extension-lab.counter.bump.menu.0",
          extensionId: "pstdio.extension-lab",
          commandId: "extension-lab.counter.bump",
          slotId: "project.headerOverflow",
          target: "workbench.nav.overflow",
          label: "Bump lab counter",
          when: {
            resourceType: ["extension-route"],
            metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
          },
        },
      ],
    });

    expect(registrations).toEqual([
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: extensionRouteResourceContextMenuPath,
            menuItem: expect.objectContaining({
              group: "primary",
              label: "Lab: Say hello",
              when: labRouteWhenExpression,
            }),
          }),
        ],
      }),
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: extensionRouteResourceContextMenuPath,
            menuItem: expect.objectContaining({
              group: "overflow",
              label: "Bump lab counter",
              overflowLabel: "Extension actions",
              when: labRouteWhenExpression,
            }),
          }),
        ],
      }),
    ]);
  });

  test("maps workspace actions only beside workspace resources", () => {
    const registrations = buildDashboardExtensionMenuRegistrations(metadata);
    const workspaceRegistration = registrations.find(
      (registration) => registration.contribution.id === "extension-lab.run-review.header",
    );

    expect(workspaceRegistration).toEqual(
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: workspaceResourceContextMenuPath,
            menuItem: expect.objectContaining({
              commandId: "dashboard.extension.menu.extension-lab.run-review.header",
              group: "primary",
              label: "Run review",
              when: 'workbench.resource.kind == "workspace"',
            }),
          }),
        ],
      }),
    );
  });
});

describe("dashboard workbench extension ticket menu contributions", () => {
  test("strips resource-resolved params from action commands, keeping user-facing input", () => {
    const registrations = buildDashboardExtensionMenuRegistrations({
      ...metadata,
      commands: [
        ...metadata.commands,
        {
          id: "pstdio-planner.run-attempt",
          extensionId: "pstdio.pstdio-planner",
          title: "Run attempt",
          params: {
            ticket: { type: "text", label: "Ticket" },
            rowId: { type: "text", label: "Ticket row" },
            agent: { type: "harness", label: "Agent" },
            repo: { type: "repo", label: "Repository" },
          },
        },
      ],
      menuContributions: [
        {
          id: "pstdio-planner.run-attempt.menu.0",
          extensionId: "pstdio.pstdio-planner",
          commandId: "pstdio-planner.run-attempt",
          slotId: "ticket.headerPrimary",
          label: "Run attempt",
        },
      ],
    });

    expect(registrations[0]?.command.params).toEqual({
      agent: { type: "harness", label: "Agent" },
      repo: { type: "repo", label: "Repository" },
    });
  });

  test("maps ticket actions only beside ticket resources", () => {
    const registrations = buildDashboardExtensionMenuRegistrations({
      ...metadata,
      commands: [
        ...metadata.commands,
        { id: "pstdio-planner.refine-ticket", extensionId: "pstdio.pstdio-planner", title: "Refine ticket" },
        {
          id: "pstdio-planner.break-into-sub-tickets",
          extensionId: "pstdio.pstdio-planner",
          title: "Break into sub-tickets",
        },
      ],
      menuContributions: [
        {
          id: "pstdio-planner.refine-ticket.menu.0",
          extensionId: "pstdio.pstdio-planner",
          commandId: "pstdio-planner.refine-ticket",
          slotId: "ticket.headerOverflow",
          label: "Refine ticket",
        },
        {
          id: "pstdio-planner.break-into-sub-tickets.menu.0",
          extensionId: "pstdio.pstdio-planner",
          commandId: "pstdio-planner.break-into-sub-tickets",
          slotId: "ticket.headerOverflow",
          label: "Break into sub-tickets",
        },
      ],
    });

    expect(registrations).toEqual([
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: ticketResourceContextMenuPath,
            menuItem: expect.objectContaining({
              group: "overflow",
              label: "Refine ticket",
              overflowLabel: "Ticket actions",
              when: 'workbench.resource.kind == "ticket"',
            }),
          }),
        ],
      }),
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: ticketResourceContextMenuPath,
            menuItem: expect.objectContaining({
              group: "overflow",
              label: "Break into sub-tickets",
              overflowLabel: "Ticket actions",
              when: 'workbench.resource.kind == "ticket"',
            }),
          }),
        ],
      }),
    ]);
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
