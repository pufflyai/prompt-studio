import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import { historicalExtensionId } from "pstdio-api-contracts/extension-identity";

export const isHistoricalCliAlias = (command: ExtensionCommandRecord, path: string) => {
  const old = historicalExtensionId(command.extensionId);
  if (old === command.extensionId || !command.cliAliases?.includes(path)) return false;
  const namespace = path.split(" ")[0];
  return (
    namespace === old ||
    namespace === old.slice(old.indexOf(".") + 1) ||
    (command.extensionId === "pstdio.notes" && /^pstdio\.notes notes (create|rename|delete)$/.test(path))
  );
};

export const deprecatedExtensionCommandMessage = (command: ExtensionCommandRecord, path: string) => {
  if (!command.cliPath?.startsWith(`${command.extensionId} `)) return null;
  if (isHistoricalCliAlias(command, path)) return `Deprecated: pst ${path} is replaced by pst ${command.cliPath}.`;
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
