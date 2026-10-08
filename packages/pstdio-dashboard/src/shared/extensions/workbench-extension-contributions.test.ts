import { describe, expect, test } from "bun:test";
import {
  matchesContextExpression,
  resourceContextMenuPath,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "@pstdio/workbench";
import { buildDashboardExtensionMenuRegistrations } from "./workbench-extension-contributions";
import { extensionLabMetadata as metadata } from "./workbench-extension-metadata.fixture";

const labViewWhenExpression = 'workbench.view.id == "pstdio.extension-lab.view.labPage"';
const ticketResourceContextMenuPath = resourceContextMenuPath("ticket");

describe("dashboard workbench extension menu contributions", () => {
  test("maps extension view actions into the header with view context", () => {
    const { registrations } = buildDashboardExtensionMenuRegistrations(metadata);
    const headerRegistrations = registrations.filter(
      (registration) =>
        registration.contribution.id.endsWith(".header") && registration.contribution.slotId.startsWith("project."),
    );
    const paletteRegistration = registrations.find(
      (registration) => registration.contribution.id === "pstdio.extension-lab.command.say-hello.palette",
    );

    expect(headerRegistrations).toEqual([
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: workbenchTopHeaderTrailingMenuPath,
            menuItem: expect.objectContaining({
              commandId: "dashboard.extension.menu.pstdio.extension-lab.command.say-hello.header",
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
              commandId: "dashboard.extension.menu.pstdio.extension-lab.command.counter.bump.header",
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
    const { registrations } = buildDashboardExtensionMenuRegistrations({
      ...metadata,
      menuContributions: [
        {
          id: "pstdio.extension-lab.command.say-hello.menu.0",
          extensionId: "pstdio.extension-lab",
          commandId: "pstdio.extension-lab.command.say-hello",
          slotId: "project.headerPrimary",
          target: "workbench.nav.actions",
          label: "Lab: Say hello",
          icon: "flask-conical",
          when: {
            viewId: "pstdio.extension-lab.view.labPage",
          },
        },
        {
          id: "pstdio.extension-lab.command.counter.bump.menu.0",
          extensionId: "pstdio.extension-lab",
          commandId: "pstdio.extension-lab.command.counter.bump",
          slotId: "project.headerOverflow",
          target: "workbench.nav.overflow",
          label: "Bump lab counter",
          when: {
            viewId: "pstdio.extension-lab.view.labPage",
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

  test("maps workspace actions to the declared resource header", () => {
    const { registrations } = buildDashboardExtensionMenuRegistrations(metadata);
    const workspaceRegistration = registrations.find(
      (registration) => registration.contribution.id === "pstdio.extension-lab.command.run-review.header",
    );

    expect(workspaceRegistration).toEqual(
      expect.objectContaining({
        menuItems: [
          expect.objectContaining({
            menuPath: resourceContextMenuPath("workspace"),
            menuItem: expect.objectContaining({
              commandId: "dashboard.extension.menu.pstdio.extension-lab.command.run-review.header",
              group: "primary",
              label: "Run review",
              when: 'workbench.resource.type == "workspace"',
            }),
          }),
        ],
      }),
    );
  });
});

describe("dashboard workbench extension ticket menu contributions", () => {
  test("keeps parameter resolution in the contribution contract", () => {
    const { registrations } = buildDashboardExtensionMenuRegistrations({
      ...metadata,
      resourceKinds: [
        {
          id: "ticket",
          localId: "ticket",
          extensionId: "pstdio.pstdio-planner",
          menuSlots: [{ id: "headerPrimary", placement: "header-primary", access: "owner" }],
        },
      ],
      commands: [
        ...metadata.commands,
        {
          id: "pstdio-planner.run-attempt",
          extensionId: "pstdio.pstdio-planner",
          title: "Run attempt",
          params: {
            ticket: { type: "text", label: "Ticket", resolvedFrom: "resource" },
            rowId: { type: "text", label: "Ticket row", resolvedFrom: "resource" },
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
          slotId: "pstdio.pstdio-planner.resource-kind.ticket.headerPrimary",
          label: "Run attempt",
        },
      ],
    });

    expect(registrations[0]?.command.params).toEqual({
      ticket: { type: "text", label: "Ticket", resolvedFrom: "resource" },
      rowId: { type: "text", label: "Ticket row", resolvedFrom: "resource" },
      agent: { type: "harness", label: "Agent" },
      repo: { type: "repo", label: "Repository" },
    });
  });

  test("maps ticket actions only beside ticket resources", () => {
    const { registrations } = buildDashboardExtensionMenuRegistrations({
      ...metadata,
      resourceKinds: [
        {
          id: "ticket",
          localId: "ticket",
          extensionId: "pstdio.pstdio-planner",
          menuSlots: [{ id: "headerOverflow", placement: "context-menu", access: "owner", label: "Ticket actions" }],
        },
      ],
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
          slotId: "pstdio.pstdio-planner.resource-kind.ticket.headerOverflow",
          label: "Refine ticket",
        },
        {
          id: "pstdio-planner.break-into-sub-tickets.menu.0",
          extensionId: "pstdio.pstdio-planner",
          commandId: "pstdio-planner.break-into-sub-tickets",
          slotId: "pstdio.pstdio-planner.resource-kind.ticket.headerOverflow",
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
              when: 'workbench.resource.type == "ticket" && workbench.resource.extensionId == "pstdio.pstdio-planner"',
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
              when: 'workbench.resource.type == "ticket" && workbench.resource.extensionId == "pstdio.pstdio-planner"',
            }),
          }),
        ],
      }),
    ]);
  });
});

test("same-kind menu slots stay scoped to their resource owner", () => {
  const owners = ["example.notes", "example.art"];
  const result = buildDashboardExtensionMenuRegistrations({
    ...metadata,
    resourceKinds: owners.map((extensionId) => ({
      id: "item",
      localId: "item",
      extensionId,
      menuSlots: [{ id: "private", placement: "context-menu", access: "owner" }],
    })),
    commands: owners.map((extensionId) => ({ id: extensionId + ".command.action", extensionId, title: "Action" })),
    menuContributions: owners.map((extensionId) => ({
      id: extensionId + ".menu.action",
      extensionId,
      commandId: extensionId + ".command.action",
      slotId: extensionId + ".resource-kind.item.private",
      label: "Action",
      when: { resourceType: ["item", "other"] },
    })),
  });
  expect(result.registrations).toHaveLength(2);
  for (const registration of result.registrations) {
    const when = registration.menuItems[0]?.menuItem.when;
    const owner = registration.contribution.extensionId;
    expect(
      matchesContextExpression({ "workbench.resource.type": "item", "workbench.resource.extensionId": owner }, when),
    ).toBe(true);
    expect(
      matchesContextExpression(
        {
          "workbench.resource.type": "item",
          "workbench.resource.extensionId": owners.find((candidate) => candidate !== owner),
        },
        when,
      ),
    ).toBe(false);
    expect(
      matchesContextExpression({ "workbench.resource.type": "other", "workbench.resource.extensionId": owner }, when),
    ).toBe(false);
  }
});
