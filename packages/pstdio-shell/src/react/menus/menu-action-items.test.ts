import { describe, expect, test } from "bun:test";
import { createShellCore, type MenuPath } from "../../core";
import { listShellMenuActionItems } from "./menu-action-items";

const menuPath = ["workbench", "top", "actions"] as const satisfies MenuPath;

describe("listShellMenuActionItems", () => {
  test("resolves visible menu actions into command-backed header items", () => {
    const shell = createShellCore();

    shell.context.set("project.open", true);
    shell.commands.registerCommand(
      { id: "project.download", label: "Download", icon: "Download" },
      { execute: () => undefined },
    );
    shell.commands.registerCommand(
      { id: "project.hidden", label: "Hidden" },
      { execute: () => undefined, isVisible: () => false },
    );
    shell.menus.registerMenuAction(menuPath, {
      commandId: "project.download",
      group: "primary",
      when: "project.open",
    });
    shell.menus.registerMenuAction(menuPath, {
      commandId: "project.hidden",
      when: "project.open",
    });
    shell.menus.registerMenuAction(menuPath, {
      commandId: "project.download",
      label: "Closed project action",
      when: "!project.open",
    });

    expect(listShellMenuActionItems(shell, menuPath)).toEqual([
      {
        id: "project.download:0",
        commandId: "project.download",
        label: "Download",
        icon: "Download",
        group: "primary",
        args: undefined,
        disabled: false,
      },
    ]);
  });

  test("marks disabled commands without dropping them", () => {
    const shell = createShellCore();

    shell.commands.registerCommand(
      { id: "project.download", label: "Download" },
      { execute: () => undefined, isEnabled: () => false },
    );
    shell.menus.registerMenuAction(menuPath, { commandId: "project.download" });

    expect(listShellMenuActionItems(shell, menuPath)[0]).toMatchObject({
      commandId: "project.download",
      disabled: true,
    });
  });

  test("keeps a contextual overflow trigger label with the menu action", () => {
    const shell = createShellCore();

    shell.commands.registerCommand({ id: "sessions.archive", label: "Archive session" }, { execute: () => undefined });
    shell.menus.registerMenuAction(menuPath, {
      commandId: "sessions.archive",
      group: "overflow",
      overflowLabel: "Session actions",
    });

    expect(listShellMenuActionItems(shell, menuPath)[0]).toMatchObject({
      commandId: "sessions.archive",
      overflowLabel: "Session actions",
    });
  });
});
