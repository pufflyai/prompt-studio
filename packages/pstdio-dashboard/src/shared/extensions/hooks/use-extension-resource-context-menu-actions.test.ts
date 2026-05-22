import { describe, expect, it, mock } from "bun:test";
import type { ExtensionActionDescriptor } from "../extension-action-params";
import { buildExtensionResourceContextMenuActions } from "./use-extension-resource-context-menu-actions";

const makeAction = (overrides: Partial<ExtensionActionDescriptor> = {}): ExtensionActionDescriptor => ({
  key: "extension:pstdio-core-ticket-automations.refineTicket.menu.0",
  label: "Refine ticket",
  targetType: "extension",
  placement: "ticket.headerOverflow",
  commandId: "pstdio-core-ticket-automations.refineTicket",
  slotId: "ticket.headerOverflow",
  baseParams: {},
  contributionParams: {},
  params: [],
  ...overrides,
});

describe("buildExtensionResourceContextMenuActions", () => {
  it("maps extension actions into resource context menu actions", () => {
    const onAction = mock(() => {});
    const actions = buildExtensionResourceContextMenuActions({
      actions: [makeAction({ icon: "wand-sparkles" })],
      pendingActionKeys: [],
      onAction,
    });

    expect(actions.map((action) => action.label)).toEqual(["Refine ticket"]);
    expect(actions[0]?.icon).toBeDefined();

    actions[0]?.onClick();

    expect(onAction).toHaveBeenCalledWith("extension:pstdio-core-ticket-automations.refineTicket.menu.0");
  });

  it("marks pending extension actions disabled", () => {
    const actions = buildExtensionResourceContextMenuActions({
      actions: [makeAction()],
      pendingActionKeys: ["extension:pstdio-core-ticket-automations.refineTicket.menu.0"],
      onAction: () => {},
    });

    expect(actions[0]?.isDisabled).toBe(true);
  });
});
