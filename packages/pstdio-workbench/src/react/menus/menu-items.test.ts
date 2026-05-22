import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type MenuPath } from "../../core";
import { listWorkbenchMenuItems, listWorkbenchMenuItemsFromState } from "./menu-items";

const menuPath = ["workbench", "top", "actions"] as const satisfies MenuPath;

describe("listWorkbenchMenuItems", () => {
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
    workbench.layout.registerMenuItem(menuPath, {
      commandId: "project.download",
      group: "primary",
      when: "project.open",
    });
    workbench.layout.registerMenuItem(menuPath, {
      commandId: "project.hidden",
      when: "project.open",
    });
    workbench.layout.registerMenuItem(menuPath, {
      commandId: "project.download",
      label: "Closed project action",
      when: "!project.open",
    });

    expect(listWorkbenchMenuItems(workbench, menuPath)).toEqual([
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
    workbench.layout.registerMenuItem(menuPath, { commandId: "project.download" });

    expect(listWorkbenchMenuItems(workbench, menuPath)[0]).toMatchObject({
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
    workbench.layout.registerMenuItem(menuPath, {
      commandId: "sessions.archive",
      group: "overflow",
      overflowLabel: "Session actions",
    });

    expect(listWorkbenchMenuItems(workbench, menuPath)[0]).toMatchObject({
      commandId: "sessions.archive",
      overflowLabel: "Session actions",
    });
  });

  test("keeps read-only metadata on menu actions", () => {
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

    expect(listWorkbenchMenuItems(workbench, menuPath)[0]).toMatchObject({
      commandId: "app.info",
      description: "v1.2.3",
      iconSrc: "/logo.svg",
      readOnly: true,
      disabled: true,
    });
  });

  test("resolves from explicit store snapshots for reactive header rendering", () => {
    const workbench = createWorkbenchCore();

    workbench.commands.registerCommand(
      { id: "sessions.archive", label: "Archive session" },
      { execute: () => undefined },
    );
    workbench.layout.registerMenuItem(menuPath, {
      commandId: "sessions.archive",
      group: "overflow",
      overflowLabel: "Session actions",
      when: "sessionId",
    });

    expect(
      listWorkbenchMenuItemsFromState(
        {
          itemsByPath: workbench.layout.menuStore.getState().itemsByPath,
          commands: workbench.commands.store.getState().commands,
          contextValues: {},
        },
        menuPath,
      ),
    ).toEqual([]);

    expect(
      listWorkbenchMenuItemsFromState(
        {
          itemsByPath: workbench.layout.menuStore.getState().itemsByPath,
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
