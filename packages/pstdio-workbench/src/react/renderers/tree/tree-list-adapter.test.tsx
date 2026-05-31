import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "../../../core";
import { toTreeListSection } from "./tree-list-adapter";

describe("toTreeListSection", () => {
  test("maps navigation targets and resources onto navigable tree rows", () => {
    const workbench = createWorkbenchCore();
    const ticketsResource = {
      kind: "dashboard-view",
      uri: "dashboard-workbench://dashboard-view/tickets",
      id: "tickets",
      label: "Tickets",
    } satisfies ResourceRef;
    const nodes = [
      {
        id: "search",
        label: "Search",
        target: { kind: "command" as const, commandId: "workbench.toggleCommandPalette" },
      },
      {
        id: "tickets",
        label: "Tickets",
        resource: ticketsResource,
      },
    ];

    const section = toTreeListSection({ id: "primary", nodes }, {}, { workbench });

    expect(section.nodes[0]).toMatchObject({
      isNavigable: true,
      navigationIntent: {
        id: "target",
        payload: { kind: "command", commandId: "workbench.toggleCommandPalette" },
      },
    });
    expect(section.nodes[1]).toMatchObject({
      isNavigable: true,
      navigationIntent: {
        id: "resource",
        payload: ticketsResource,
      },
    });
  });
});
