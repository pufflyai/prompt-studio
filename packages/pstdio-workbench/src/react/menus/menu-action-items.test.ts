import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type MenuPath } from "../../core";
import { listWorkbenchMenuActionItems, listWorkbenchMenuActionItemsFromState } from "./menu-action-items";

const menuPath = ["workbench", "top", "actions"] as const satisfies MenuPath;

describe("listWorkbenchMenuActionItems", () => {
  test("resolves visible menu actions into command-backed header items", () => {
    const workbench = createWorkbenchCore();

    workbench.context.set("project.open", true);
    workbench.commands.registerCommand(
      { id: "project.download", label: "Download", icon: "Download" },
      { execute: () => undefined },
    );
    workbench.commands.registerCommand(
      { id: "project.hidden", label: "Hidden" },
      { execute: () => undefined, isVisible: () => false },
    );
    workbench.menus.registerMenuAction(menuPath, {
      commandId: "project.download",
      group: "primary",
      when: "project.open",
    });
    workbench.menus.registerMenuAction(menuPath, {
      commandId: "project.hidden",
      when: "project.open",
    });
    workbench.menus.registerMenuAction(menuPath, {
      commandId: "project.download",
      label: "Closed project action",
      when: "!project.open",
    });

    expect(listWorkbenchMenuActionItems(workbench, menuPath)).toEqual([
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
    const workbench = createWorkbenchCore();

    workbench.commands.registerCommand(
      { id: "project.download", label: "Download" },
      { execute: () => undefined, isEnabled: () => false },
    );
    workbench.menus.registerMenuAction(menuPath, { commandId: "project.download" });

    expect(listWorkbenchMenuActionItems(workbench, menuPath)[0]).toMatchObject({
      commandId: "project.download",
      disabled: true,
    });
  });

  test("keeps a contextual overflow trigger label with the menu action", () => {
    const workbench = createWorkbenchCore();

    workbench.commands.registerCommand(
      { id: "sessions.archive", label: "Archive session" },
      { execute: () => undefined },
    );
    workbench.menus.registerMenuAction(menuPath, {
      commandId: "sessions.archive",
      group: "overflow",
      overflowLabel: "Session actions",
    });

    expect(listWorkbenchMenuActionItems(workbench, menuPath)[0]).toMatchObject({
      commandId: "sessions.archive",
      overflowLabel: "Session actions",
    });
  });

  test("resolves from explicit store snapshots for reactive header rendering", () => {
    const workbench = createWorkbenchCore();

    workbench.commands.registerCommand(
      { id: "sessions.archive", label: "Archive session" },
      { execute: () => undefined },
    );
    workbench.menus.registerMenuAction(menuPath, {
      commandId: "sessions.archive",
      group: "overflow",
      overflowLabel: "Session actions",
      when: "sessionId",
    });

    expect(
      listWorkbenchMenuActionItemsFromState(
        {
          actionsByPath: workbench.menus.store.getState().actionsByPath,
          commands: workbench.commands.store.getState().commands,
          contextValues: {},
        },
        menuPath,
      ),
    ).toEqual([]);

    expect(
      listWorkbenchMenuActionItemsFromState(
        {
          actionsByPath: workbench.menus.store.getState().actionsByPath,
          commands: workbench.commands.store.getState().commands,
          contextValues: { sessionId: "session-1" },
        },
        menuPath,
      )[0],
    ).toMatchObject({
      commandId: "sessions.archive",
      overflowLabel: "Session actions",
    });
  });
});
