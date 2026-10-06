import { expect, test } from "bun:test";
import { createWorkbenchResourceContextValues, matchesContextExpression } from "@pstdio/workbench";
import { canonicalDashboardPageTarget, canonicalDashboardResource } from "./resource-identity";
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

test("page targets and their parents use the same owner and project identity as resource trees", () => {
  const target = {
    kind: "page" as const,
    page: { kind: "page" as const, id: "workspace", extensionId: "pstdio" },
    resource: { type: "workspace", id: "one" },
    parent: {
      kind: "page" as const,
      page: { kind: "page" as const, id: "ticket", extensionId: "example.planner" },
      resource: { type: "ticket", id: "one", metadata: { documentId: "body" } },
    },
  };
  const kinds = [{ id: "ticket", extensionId: "example.planner" }];
  const resolved = canonicalDashboardPageTarget(target, "project", kinds);
  expect(resolved.resource).toEqual(canonicalDashboardResource(target.resource, "project", kinds));
  expect(resolved.parent?.resource).toEqual(canonicalDashboardResource(target.parent.resource, "project", kinds));
  expect(resolved.parent?.page).toEqual(target.parent.page);
});
