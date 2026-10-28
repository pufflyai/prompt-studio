import type { ExtensionCommandRecord } from "@pstdio/sdk/api";

export const deprecatedExtensionCommandMessage = (command: ExtensionCommandRecord, path: string) => {
  if (!command.cliPath?.startsWith(`${command.extensionId} `)) return null;
  if (command.cliAliases?.includes(path)) return null;
  const shortName = command.extensionId.split(".")[1];
  if (path.split(" ")[0] !== shortName) return null;
  return `Deprecated: pst ${shortName} is replaced by pst ${command.extensionId}.`;
};

export const warnDeprecatedExtensionCommand = (
  command: ExtensionCommandRecord,
  path: string,
  write: (message: string) => void,
  enabled = true,
) => {
  if (!enabled) return;
  const message = deprecatedExtensionCommandMessage(command, path);
  if (message) write(message);
};
