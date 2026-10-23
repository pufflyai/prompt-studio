import type { WorkbenchCore } from "./workbench-core-types";
export const workbenchShortcutActions = (core: WorkbenchCore) => [
  ...core.navigationTrees.listActions(),
  ...Object.values(core.layout.menuStore.getState().itemsByPath)
    .flat()
    .map((item) => ({
      label: item.label ?? core.commands.getCommand(item.commandId)?.command.label ?? item.commandId,
      ownerId: item.ownerId,
      aliasCommandId: item.sourceCommandId && item.sourceCommandId !== item.commandId ? item.commandId : undefined,
      action: {
        kind: "command" as const,
        commandId: item.sourceCommandId ?? item.commandId,
        ...(item.args === undefined ? {} : { args: item.args }),
      },
    })),
];
