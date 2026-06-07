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

  test("requests params before running context menu actions with params", () => {
    const workbench = createWorkbenchCore();
    const run = mock();
    const requestParams = mock();

    const items = createTreeContextMenuItems({
      actions: [
        {
          id: "rename",
          label: "Rename",
          args: { fileId: "file-1", name: "notes.md" },
          params: { name: { type: "text", label: "File name", required: true } },
          run,
        },
      ],
      onRequestParams: requestParams,
      workbench,
    });

    items[0]?.onAction?.();

    expect(run).not.toHaveBeenCalled();
    expect(requestParams).toHaveBeenCalledWith(
      expect.objectContaining({
        run: expect.any(Function),
        request: {
          record: {
            command: {
              id: "rename",
              label: "Rename",
              params: { name: { type: "text", label: "File name", required: true } },
            },
          },
          label: "Rename",
          args: { fileId: "file-1", name: "notes.md" },
        },
      }),
    );

    const requested = requestParams.mock.calls[0]?.[0];
    requested?.run({ fileId: "file-1", name: "renamed.md" });

    expect(run).toHaveBeenCalledWith({ fileId: "file-1", name: "renamed.md" });
  });

  test("uses menu action params for prompted command actions", () => {
    const workbench = createWorkbenchCore();
    const requestParams = mock();

    workbench.commands.registerCommand({ id: "files.rename", label: "Rename file" }, { execute: () => undefined });

    const items = createTreeContextMenuItems({
      actions: [
        {
          id: "rename",
          label: "Rename",
          commandId: "files.rename",
          args: { fileId: "file-1", name: "notes.md" },
          params: { name: { type: "text", label: "File name", required: true } },
        },
      ],
      onRequestParams: requestParams,
      workbench,
    });

    items[0]?.onAction?.();

    expect(requestParams).toHaveBeenCalledWith({
      request: {
        record: {
          command: {
            id: "files.rename",
            label: "Rename",
            params: { name: { type: "text", label: "File name", required: true } },
          },
        },
        label: "Rename",
        args: { fileId: "file-1", name: "notes.md" },
      },
      run: expect.any(Function),
    });
  });

  test("adds trailing content to external menu links", () => {
    const workbench = createWorkbenchCore();

    workbench.commands.registerCommand({ id: "app.docs", label: "Documentation" }, { execute: () => undefined });
    workbench.layout.registerMenuItem(menuPath, { commandId: "app.docs", external: true });

    const items = createTreeMenuItems({ menuPath, workbench });

    expect(items[0]?.endContent).toBeDefined();
  });
});
