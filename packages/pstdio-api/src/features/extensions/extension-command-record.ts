import type { ExtensionCommandRecord } from "pstdio-api-contracts";
import type { RuntimeCommandRecord } from "pstdio-extensions";

export const toCommandRecord = (command: RuntimeCommandRecord): ExtensionCommandRecord => ({
  id: command.id,
  extensionId: command.extensionId,
  title: command.title,
  description: command.description,
  cliPath: command.cli?.pathKey,
  cliAliases: command.cli?.globalAliases?.map((alias) => alias.join(" ")),
  examples: command.cli?.examples,
  automation: command.automation,
  params: command.params as ExtensionCommandRecord["params"],
});
