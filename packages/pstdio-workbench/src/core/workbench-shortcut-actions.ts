import { createKeyboardController } from "./controllers/keyboard/keyboard-controller";
import { createKeybindingRegistry } from "./registries/keybindings/keybinding-registry";
import type { WorkbenchCore } from "./workbench-core-types";

export const createWorkbenchKeyboard = (
  resolveCore: () => WorkbenchCore,
  commands: WorkbenchCore["commands"],
  context: WorkbenchCore["context"],
) => ({
  keyboard: createKeyboardController(resolveCore),
  keybindings: createKeybindingRegistry({
    commands,
    context,
    preferences: () => resolveCore().preferences,
    actions: () => workbenchShortcutActions(resolveCore()),
  }),
});

export const workbenchShortcutActions = (core: WorkbenchCore) => [
  ...core.navigationTrees.listActions().map((action) => ({
    ...action,
    source: action.ownerId === "pstdio" ? ("module" as const) : ("extension" as const),
  })),
  ...Object.values(core.layout.menuStore.getState().itemsByPath)
    .flat()
    .map((item) => ({
      label: item.label ?? core.commands.getCommand(item.commandId)?.command.label ?? item.commandId,
      ownerId: item.ownerId,
      source: item.source,
      aliasCommandId: item.sourceCommandId && item.sourceCommandId !== item.commandId ? item.commandId : undefined,
      action: {
        kind: "command" as const,
        commandId: item.sourceCommandId ?? item.commandId,
        ...(item.args === undefined ? {} : { args: item.args }),
      },
    })),
];
