import type { WorkbenchCore } from "@pstdio/workbench";

interface DesktopCommandsBridge {
  onCommand: (listener: (commandId: string) => void) => () => void;
}

const hasCommands = (bridge: unknown): bridge is DesktopCommandsBridge =>
  Boolean(bridge && typeof bridge === "object" && "onCommand" in bridge && typeof bridge.onCommand === "function");

export const connectDesktopCommands = (bridge: unknown, workbench: WorkbenchCore) => {
  if (!hasCommands(bridge)) return undefined;
  return bridge.onCommand(async (commandId) => {
    try {
      await workbench.commands.executeCommand(commandId);
    } catch (error) {
      const command = workbench.commands.getCommand(commandId)?.command;
      workbench.notifications.show({
        level: "error",
        title: `${command?.label ?? "Action"} failed`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
