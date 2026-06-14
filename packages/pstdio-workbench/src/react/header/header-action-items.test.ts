import { describe, expect, test } from "bun:test";
import type { WorkbenchMenuItem } from "../menus/menu-items";
import { resolveWorkbenchHeaderActionGroups } from "./header-action-items";

const item = (input: Pick<WorkbenchMenuItem, "id" | "label"> & Partial<WorkbenchMenuItem>) =>
  ({
    commandId: input.commandId ?? input.id,
    icon: input.icon,
    args: undefined,
    disabled: false,
    group: input.group,
    ...input,
  }) satisfies WorkbenchMenuItem;

describe("resolveWorkbenchHeaderActionGroups", () => {
  test("places regular overflow actions before kernel overflow actions with a separator", () => {
    const groups = resolveWorkbenchHeaderActionGroups([
      item({ id: "review", label: "Run review", group: "primary" }),
      item({ id: "rename", label: "Rename workspace", group: "kernel" }),
      item({ id: "delete", label: "Delete workspace", group: "kernel" }),
      item({ id: "open-vscode", label: "Open in VS Code", group: "overflow" }),
    ]);

    expect(groups.inlineItems.map((action) => action.label)).toEqual(["Run review"]);
    expect(
      groups.overflowItems.map((action) => ({
        label: action.label,
        separatorBefore: action.separatorBefore,
      })),
    ).toEqual([
      { label: "Open in VS Code", separatorBefore: undefined },
      { label: "Rename workspace", separatorBefore: true },
      { label: "Delete workspace", separatorBefore: undefined },
    ]);
  });

  test("does not add a leading separator when only kernel overflow actions are visible", () => {
    const groups = resolveWorkbenchHeaderActionGroups([
      item({ id: "review", label: "Run review", group: "primary" }),
      item({ id: "rename", label: "Rename workspace", group: "kernel" }),
      item({ id: "delete", label: "Delete workspace", group: "kernel" }),
    ]);

    expect(groups.inlineItems.map((action) => action.label)).toEqual(["Run review"]);
    expect(groups.overflowItems.map((action) => action.separatorBefore)).toEqual([undefined, undefined]);
  });
});
