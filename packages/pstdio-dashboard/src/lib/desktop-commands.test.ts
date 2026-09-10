import { expect, test } from "bun:test";
import { createDashboardWorkbench } from "../workbench";
import { connectDesktopCommands } from "./desktop-commands";

test("native commands use the workbench command handlers and unsubscribe on teardown", async () => {
  const workbench = createDashboardWorkbench();
  let receive: ((id: string) => void) | undefined;
  const stop = connectDesktopCommands(
    {
      onCommand: (listener: (id: string) => void) => {
        receive = listener;
        return () => {
          receive = undefined;
        };
      },
    },
    workbench,
  );

  await receive?.("dashboard.openCommandPalette");
  expect(workbench.commandPalette.isOpen()).toBe(true);
  await receive?.("workbench.action.changeTheme");
  expect(workbench.commandPalette.getView()).toBe("theme");
  await receive?.("workbench.toggleSideBar");
  expect(workbench.shell.getRegionState("sidenav").open).toBe(false);
  stop?.();
  expect(receive).toBeUndefined();
});

test("shows failed native commands through workbench notifications", async () => {
  const workbench = createDashboardWorkbench();
  let receive: ((id: string) => void) | undefined;
  connectDesktopCommands(
    {
      onCommand: (listener: (id: string) => void) => {
        receive = listener;
        return () => {};
      },
    },
    workbench,
  );
  workbench.commands.registerCommand(
    { id: "unavailable", label: "Unavailable action" },
    {
      execute: () => {
        throw new Error("The action could not finish.");
      },
    },
  );

  await receive?.("unavailable");
  expect(workbench.notifications.listNotifications()).toMatchObject([
    { level: "error", message: "The action could not finish." },
  ]);
});

test("does not connect native commands in a browser", () => {
  expect(connectDesktopCommands(undefined, createDashboardWorkbench())).toBeUndefined();
});
