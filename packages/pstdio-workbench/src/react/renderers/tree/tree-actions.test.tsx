import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type MenuPath } from "../../../core";
import { createTreeContextMenuItems, createTreeMenuItems } from "./tree-actions";

const menuPath = ["workbench", "tree", "resource"] as const satisfies MenuPath;

describe("createTreeContextMenuItems", () => {
  test("resolves tree actions and menu path actions for right-click context menus", async () => {
    const workbench = createWorkbenchCore();
    const archive = mock();

    workbench.commands.registerCommand(
      { id: "resource.copy", label: "Copy resource" },
      { execute: () => undefined, isEnabled: () => false },
    );
    workbench.layout.registerMenuItem(menuPath, { commandId: "resource.copy" });

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

  test("resolves menu action metadata for read-only informational rows", () => {
    const workbench = createWorkbenchCore();

    workbench.commands.registerCommand(
      { id: "app.info", label: "Prompt Studio", description: "v1.2.3" },
      { execute: () => undefined },
    );
    workbench.layout.registerMenuItem(menuPath, {
      commandId: "app.info",
      description: "v1.2.3",
      iconSrc: "/logo.svg",
      readOnly: true,
    });

    const items = createTreeMenuItems({ menuPath, workbench });

    expect(items[0]).toMatchObject({
      id: "app.info:0",
      label: "Prompt Studio",
      description: "v1.2.3",
      disabled: true,
      readOnly: true,
    });
    expect(items[0]?.icon).toBeDefined();
  });

  test("adds trailing content to external menu links", () => {
    const workbench = createWorkbenchCore();

    workbench.commands.registerCommand({ id: "app.docs", label: "Documentation" }, { execute: () => undefined });
    workbench.layout.registerMenuItem(menuPath, { commandId: "app.docs", external: true });

    const items = createTreeMenuItems({ menuPath, workbench });

    expect(items[0]?.endContent).toBeDefined();
  });
});
