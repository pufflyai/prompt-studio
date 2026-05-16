import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type MenuPath } from "../../core";
import { createTreeContextMenuItems } from "./tree-actions";

const menuPath = ["workbench", "tree", "resource"] as const satisfies MenuPath;

describe("createTreeContextMenuItems", () => {
  test("resolves tree actions and menu path actions for right-click context menus", async () => {
    const workbench = createWorkbenchCore();
    const archive = mock();

    workbench.commands.registerCommand(
      { id: "resource.copy", label: "Copy resource" },
      { execute: () => undefined, isEnabled: () => false },
    );
    workbench.menus.registerMenuAction(menuPath, { commandId: "resource.copy" });

    const items = createTreeContextMenuItems({
      actions: [{ id: "archive", label: "Archive", icon: "Archive", run: archive }],
      menuPath,
      workbench,
    });

    expect(items.map((item) => ({ id: item.id, label: item.label, disabled: item.disabled }))).toEqual([
      { id: "resource.copy:0", label: "Copy resource", disabled: true },
      { id: "archive", label: "Archive", disabled: false },
    ]);

    items[1]?.onAction?.();
    await Promise.resolve();

    expect(archive).toHaveBeenCalled();
  });
});
