import { Dialog, Flex, Menu, Stack, Text } from "@chakra-ui/react";
import { PaletteShortcut, ScrollArea } from "@pstdio/ui";
import type { KeybindingSequence } from "@pstdio/workbench";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";

interface ShortcutEntry {
  id: string;
  label: string;
  category: string;
  keybinding: KeybindingSequence;
}

const buildShortcutEntries = (input: WorkbenchPanelRenderInput): ShortcutEntry[] => {
  return input.workbench.keybindings
    .listActiveKeybindings()
    .map((keybinding) => {
      const record = input.workbench.commands.getCommand(keybinding.commandId);
      if (!record) return null;

      return {
        id: keybinding.commandId,
        label: record.command.label,
        category: record.command.category ?? "Workbench",
        keybinding: keybinding.keybinding,
      };
    })
    .filter((entry): entry is ShortcutEntry => entry !== null)
    .sort((left, right) => {
      const categoryComparison = left.category.localeCompare(right.category);
      if (categoryComparison !== 0) return categoryComparison;
      return left.label.localeCompare(right.label);
    });
};

export const KeyboardShortcutsWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const shortcuts = buildShortcutEntries(input);

  return (
    <Stack gap="0" minW="0">
      <Dialog.Header pr="10">
        <Stack gap="2xs" flex="1">
          <Text textStyle="heading/S">Keyboard shortcuts</Text>
        </Stack>
      </Dialog.Header>
      <Dialog.Body>
        <ScrollArea maxH="24rem" showHorizontalScrollbar={false} contentProps={{ pr: "2xs" }}>
          <Menu.Root open closeOnSelect={false}>
            <Menu.Content position="static" minW="full" bg="transparent" borderWidth="0" p="0" gap="0">
              {shortcuts.map((shortcut) => (
                <Menu.Item
                  key={shortcut.id}
                  value={shortcut.id}
                  cursor="default"
                  bg="bg.menu-item.default"
                  _hover={{ bg: "bg.menu-item.hover" }}
                  _highlighted={{ bg: "bg.menu-item.hover" }}
                  _focusVisible={{ bg: "bg.menu-item.focus" }}
                  px="sm"
                  py="xs"
                  minH="2rem"
                >
                  <Flex justifyContent="space-between" alignItems="center" gap="xs" flex="1" minW="0">
                    <Text lineClamp={1} textOverflow="ellipsis" textStyle="label/M/regular">
                      {shortcut.label}
                    </Text>
                    <Flex justifyContent="flex-end" alignItems="center" gap="xs" color="fg.menu-item.default">
                      <PaletteShortcut binding={shortcut.keybinding} />
                    </Flex>
                  </Flex>
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Root>
        </ScrollArea>
      </Dialog.Body>
    </Stack>
  );
};
