import { CloseButton, Dialog, Flex, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ShellWidgetRenderInput } from "pstdio-shell/react";
import { useSyncExternalStore } from "react";
import { SHORTCUTS_HELP_WIDGET_ID } from "../constants";
import { buildShortcutHelpEntries } from "../shortcut-help-model";
import { ShortcutKbd } from "../shortcut-kbd";

export const ShortcutHelpWidget = (props: { input: ShellWidgetRenderInput }) => {
  const { shell } = props.input;

  // The help list is derived from two stores — bindings + commands — so we
  // re-read on either change to keep dynamic registrations visible.
  const entries = useSyncExternalStore(
    (listener) => {
      const unsubKeybindings = shell.keybindings.store.subscribe(listener);
      const unsubCommands = shell.commands.store.subscribe(listener);
      return () => {
        unsubKeybindings();
        unsubCommands();
      };
    },
    () => buildShortcutHelpEntries(shell),
    () => buildShortcutHelpEntries(shell),
  );

  const handleClose = () => {
    shell.layout.closeWidget(SHORTCUTS_HELP_WIDGET_ID);
  };

  return (
    <Dialog.Root open onOpenChange={(details) => !details.open && handleClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="42rem">
          <Dialog.Header>
            <Stack gap="2xs" flex="1">
              <Text textStyle="heading/S">Keyboard Shortcuts</Text>
            </Stack>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <ScrollArea maxH="24rem" showHorizontalScrollbar={false} contentProps={{ pr: "2xs" }}>
              <Stack gap="0">
                {entries.map((entry) => (
                  <Flex
                    key={entry.id}
                    justifyContent="space-between"
                    alignItems="center"
                    gap="xs"
                    px="sm"
                    py="xs"
                    minH="2rem"
                  >
                    <Text lineClamp={1} textOverflow="ellipsis" textStyle="label/M/regular">
                      {entry.actionLabel}
                    </Text>
                    <Flex justifyContent="flex-end" alignItems="center" gap="xs">
                      <ShortcutKbd binding={entry.binding} />
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            </ScrollArea>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
