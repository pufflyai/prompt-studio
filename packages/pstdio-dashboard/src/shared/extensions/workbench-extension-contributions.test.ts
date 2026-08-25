import { describe, expect, test } from "bun:test";
import {
  resourceContextMenuPath,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "@pstdio/workbench";
import { buildDashboardExtensionMenuRegistrations } from "./workbench-extension-contributions";
import { extensionLabMetadata as metadata } from "./workbench-extension-metadata.fixture";

const labViewWhenExpression = 'workbench.view.id == "extension-lab.labPage"';
const workspaceResourceContextMenuPath = resourceContextMenuPath("workspace");
const ticketResourceContextMenuPath = resourceContextMenuPath("ticket");

describe("dashboard workbench extension menu contributions", () => {
  test("maps extension view actions into the header with view context", () => {
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
            menuPath: workbenchTopHeaderTrailingMenuPath,
            menuItem: expect.objectContaining({
              commandId: "dashboard.extension.menu.extension-lab.say-hello.header",
              group: "primary",
              when: labViewWhenExpression,
            }),
          }),
        ],
      }),
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: workbenchTopHeaderTrailingMenuPath,
            menuItem: expect.objectContaining({
              commandId: "dashboard.extension.menu.extension-lab.counter.bump.header",
              group: "overflow",
              overflowLabel: "Extension actions",
              when: labViewWhenExpression,
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
            viewId: "extension-lab.labPage",
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
            viewId: "extension-lab.labPage",
          },
        },
      ],
    });

    expect(registrations).toEqual([
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: workbenchTopHeaderTrailingMenuPath,
            menuItem: expect.objectContaining({
              group: "primary",
              label: "Lab: Say hello",
              when: labViewWhenExpression,
            }),
          }),
        ],
      }),
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: workbenchTopHeaderTrailingMenuPath,
            menuItem: expect.objectContaining({
              group: "overflow",
              label: "Bump lab counter",
              overflowLabel: "Extension actions",
              when: labViewWhenExpression,
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
