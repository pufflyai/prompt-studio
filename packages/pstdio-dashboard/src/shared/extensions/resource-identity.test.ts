import { expect, test } from "bun:test";
import { createWorkbenchResourceContextValues, matchesContextExpression } from "@pstdio/workbench";
import { canonicalDashboardResource } from "./resource-identity";
import {
  buildDashboardExtensionMenuRegistrations,
  emptyDashboardExtensionMetadata,
} from "./workbench-extension-contributions";

test("legacy unowned ticket references retain owner actions through canonical metadata", () => {
  const extensionId = "pstdio.pstdio-planner";
  const kinds = [
    {
      id: "ticket",
      localId: "ticket",
      extensionId,
      menuSlots: [{ id: "actions", placement: "context-menu" as const, access: "owner" as const }],
    },
  ];
  const ref = canonicalDashboardResource({ type: "ticket", id: "one" }, "project", kinds);
  expect(ref.extensionId).toBe(extensionId);
  const result = buildDashboardExtensionMenuRegistrations({
    ...emptyDashboardExtensionMetadata,
    resourceKinds: kinds,
    commands: [{ id: `${extensionId}.command.action`, extensionId, title: "Action" }],
    menuContributions: [
      {
        id: "action",
        extensionId,
        commandId: `${extensionId}.command.action`,
        slotId: `${extensionId}.resource-kind.ticket.actions`,
        label: "Action",
      },
    ],
  });
  expect(
    matchesContextExpression(
      createWorkbenchResourceContextValues(ref),
      result.registrations[0]?.menuItems[0]?.menuItem.when,
    ),
  ).toBe(true);
});

test("owner inference considers declarations with no resolver and preserves explicit ownership", () => {
  const kinds = [
    { id: "item", extensionId: "example.notes" },
    { id: "item", extensionId: "example.art" },
  ];
  expect(canonicalDashboardResource({ type: "item", id: "one" }, "project", kinds).extensionId).toBeUndefined();
  expect(
    canonicalDashboardResource({ type: "item", id: "one", extensionId: "example.art" }, "project", kinds).extensionId,
  ).toBe("example.art");
});
