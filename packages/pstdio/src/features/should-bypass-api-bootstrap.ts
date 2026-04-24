const BYPASSED_TOP_LEVEL_COMMANDS = new Set(["close", "serve", "extensions"]);

export const shouldBypassApiBootstrap = (topLevelCommand: unknown) =>
  typeof topLevelCommand === "string" && BYPASSED_TOP_LEVEL_COMMANDS.has(topLevelCommand);
