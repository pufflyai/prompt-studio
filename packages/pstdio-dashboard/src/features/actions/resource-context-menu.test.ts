import { describe, expect, it, mock } from "bun:test";
import { Archive } from "lucide-react";
import { createElement } from "react";
import type { HeaderActionItem } from "./header-actions";
import { buildResourceContextMenuActions, toSidebarContextMenuItems } from "./resource-context-menu";

const makeAction = (overrides: Partial<HeaderActionItem> = {}): HeaderActionItem => ({
  key: "archive-ticket",
  label: "Archive ticket",
  kind: "default",
  onClick: () => {},
  ...overrides,
});

describe("buildResourceContextMenuActions", () => {
  it("flattens primary, secondary, and overflow actions in order", () => {
    const actions = buildResourceContextMenuActions({
      actions: [
        makeAction({ key: "create-workspace", label: "Create workspace", placement: "primary" }),
        makeAction({ key: "copy-session", label: "Copy session", placement: "secondary" }),
        makeAction({ key: "delete-ticket", label: "Delete ticket" }),
      ],
    });

    expect(actions.map((action) => action.key)).toEqual(["create-workspace", "copy-session", "delete-ticket"]);
  });

  it("marks pending actions as disabled", () => {
    const actions = buildResourceContextMenuActions({
      actions: [makeAction()],
      pendingActionKeys: ["archive-ticket"],
    });

    expect(actions.every((action) => action.isDisabled)).toBe(true);
  });

  it("maps action metadata for sidebar context menus", () => {
    const onClick = mock(() => {});
    const actions = toSidebarContextMenuItems([
      {
        key: "archive-ticket",
        label: "Archive ticket",
        icon: createElement(Archive),
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
