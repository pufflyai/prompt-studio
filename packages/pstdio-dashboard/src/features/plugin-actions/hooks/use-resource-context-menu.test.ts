import { describe, expect, it, mock } from "bun:test";
import { Archive } from "lucide-react";
import type { ActionDescriptor } from "../api";
import type { HeaderActionItem } from "../components/header-action-groups";
import { buildResourceContextMenuActions, toSidebarContextMenuItems } from "./use-resource-context-menu";

const makePluginAction = (overrides: Partial<ActionDescriptor> = {}): ActionDescriptor => ({
  key: "plugin/run-attempt",
  label: "Run attempt",
  targetType: "ticket",
  placement: "primary",
  ...overrides,
});

const makeDefaultAction = (overrides: Partial<HeaderActionItem> = {}): HeaderActionItem => ({
  key: "archive-ticket",
  label: "Archive ticket",
  kind: "default",
  onClick: () => {},
  ...overrides,
});

describe("buildResourceContextMenuActions", () => {
  it("flattens primary, secondary, and overflow actions in order", () => {
    const actions = buildResourceContextMenuActions({
      pluginActions: [
        makePluginAction(),
        makePluginAction({ key: "plugin/review", label: "Run review", placement: "secondary" }),
        makePluginAction({ key: "plugin/open", label: "Open in IDE", placement: "overflow" }),
      ],
      defaultOverflowActions: [makeDefaultAction({ key: "delete-ticket", label: "Delete ticket" })],
      pendingActionKeys: [],
      onPluginAction: () => {},
    });

    expect(actions.map((action) => action.key)).toEqual([
      "plugin/run-attempt",
      "plugin/review",
      "plugin/open",
      "delete-ticket",
    ]);
  });

  it("marks pending actions as disabled", () => {
    const actions = buildResourceContextMenuActions({
      pluginActions: [makePluginAction()],
      defaultOverflowActions: [makeDefaultAction()],
      pendingActionKeys: ["plugin/run-attempt", "archive-ticket"],
      onPluginAction: () => {},
    });

    expect(actions.every((action) => action.isDisabled)).toBe(true);
  });

  it("wires plugin action callbacks", () => {
    const onPluginAction = mock(() => {});
    const actions = buildResourceContextMenuActions({
      pluginActions: [makePluginAction()],
      defaultOverflowActions: [],
      pendingActionKeys: [],
      onPluginAction,
    });

    actions[0]?.onClick();

    expect(onPluginAction).toHaveBeenCalledWith("plugin/run-attempt");
  });

  it("maps action metadata for sidebar context menus", () => {
    const onClick = mock(() => {});
    const actions = toSidebarContextMenuItems([
      {
        key: "archive-ticket",
        label: "Archive ticket",
        kind: "default",
        icon: Archive,
        isDisabled: true,
        onClick,
      },
    ]);

    expect(actions).toHaveLength(1);
    expect(actions[0]?.icon).toBeDefined();
    expect((actions[0] as { disabled?: boolean }).disabled).toBe(true);
    actions[0]?.onAction?.();
    expect(onClick).toHaveBeenCalled();
  });
});
