import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import { historicalCliPaths } from "pstdio-api-contracts/extension-host";

export const isHistoricalCliAlias = (command: ExtensionCommandRecord, path: string) => {
  if (!command.cliPath?.startsWith(`${command.extensionId} `) || !command.cliAliases?.includes(path)) return false;
  const relativePath = command.cliPath.slice(command.extensionId.length + 1).split(" ");
  // Older command metadata omitted localId. Only Notes' three known concise
  // verbs need a different historical tail; never parse the opaque command ID.
  const localId =
    command.localId ??
    (command.extensionId === "pstdio.notes" && relativePath.length === 1
      ? `notes.${relativePath[0]}`
      : relativePath.join("."));
  return historicalCliPaths(command.extensionId, localId, relativePath).some((parts) => parts.join(" ") === path);
};

export const deprecatedExtensionCommandMessage = (command: ExtensionCommandRecord, path: string) => {
  if (!command.cliPath?.startsWith(`${command.extensionId} `)) return null;
  if (isHistoricalCliAlias(command, path)) return `Deprecated: pst ${path} is replaced by pst ${command.cliPath}.`;
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
