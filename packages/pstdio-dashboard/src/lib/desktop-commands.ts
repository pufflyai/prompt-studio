import { runUserAction, type WorkbenchCore } from "@pstdio/workbench";

interface DesktopCommandsBridge {
  onCommand: (listener: (commandId: string) => void) => () => void;
}

const hasCommands = (bridge: unknown): bridge is DesktopCommandsBridge =>
  Boolean(bridge && typeof bridge === "object" && "onCommand" in bridge && typeof bridge.onCommand === "function");

/** Native menu commands run once, in the workbench the window shows when they arrive. */
export const connectDesktopCommands = (bridge: unknown, getWorkbench: () => WorkbenchCore | undefined) => {
  if (!hasCommands(bridge)) return undefined;
  return bridge.onCommand(async (commandId) => {
    const workbench = getWorkbench();
    if (!workbench) return;
    const command = workbench.commands.getCommand(commandId)?.command;
    await runUserAction(workbench, command?.label ?? "Action", () => workbench.commands.executeCommand(commandId));
  });
};
