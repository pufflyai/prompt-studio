import { HStack, Text } from "@chakra-ui/react";
import { PaletteShortcut } from "@pstdio/ui";
import { Fragment } from "react";
import type { KeybindingSequence, WorkbenchCore } from "../../core";

export interface WorkbenchCommandShortcut {
  id: string;
  commandId: string;
  keybinding: KeybindingSequence;
}

export const keybindingSequenceId = (keybinding: KeybindingSequence) =>
  Array.isArray(keybinding) ? keybinding.join(" ") : keybinding;

export const listWorkbenchCommandShortcuts = (workbench: WorkbenchCore): WorkbenchCommandShortcut[] =>
  workbench.keybindings.listActiveKeybindings().map((keybinding) => ({
    id: `${keybinding.commandId}:${keybindingSequenceId(keybinding.keybinding)}`,
    commandId: keybinding.commandId,
    keybinding: keybinding.keybinding,
  }));

export const createWorkbenchCommandShortcutMap = (workbench: WorkbenchCore) => {
  const shortcuts = new Map<string, KeybindingSequence[]>();

  for (const shortcut of listWorkbenchCommandShortcuts(workbench)) {
    const bindings = shortcuts.get(shortcut.commandId);
    if (bindings) {
      bindings.push(shortcut.keybinding);
    } else {
      shortcuts.set(shortcut.commandId, [shortcut.keybinding]);
    }
  }

  return shortcuts;
};

export const WorkbenchShortcutList = (props: { bindings: readonly KeybindingSequence[] }) => {
  const { bindings } = props;

  if (bindings.length === 0) return null;

  return (
    <HStack as="span" gap="1" minW="0">
      {bindings.map((binding, index) => (
        <Fragment key={keybindingSequenceId(binding)}>
          <PaletteShortcut binding={binding} />
          {index < bindings.length - 1 ? (
            <Text as="span" textStyle="label/XS/regular" color="fg.muted">
              /
            </Text>
          ) : null}
        </Fragment>
      ))}
    </HStack>
  );
};
