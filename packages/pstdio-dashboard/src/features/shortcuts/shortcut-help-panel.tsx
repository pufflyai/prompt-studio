import { CloseButton, Dialog, Flex, Menu, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { ShortcutKbd } from "./shortcut-kbd";
import { SHORTCUT_DEFINITIONS } from "./shortcut-registry";

export const ShortcutHelpPanel = (props: { open: boolean; onClose: () => void }) => {
  const { open, onClose } = props;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => !details.open && onClose()}
      onRequestDismiss={(event) => {
        // Avoid being dismissed by zag's layer-stack cascade when the command
        // palette (and its inner Menu layer) closes in the same render cycle.
        event.preventDefault();
      }}
    >
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
              <Menu.Root open closeOnSelect={false}>
                <Menu.Content
                  position="static"
                  minW="full"
                  bg="transparent"
                  boxShadow="none"
                  borderWidth="0"
                  p="0"
                  gap="0"
                >
                  {SHORTCUT_DEFINITIONS.map((shortcut) => (
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
                      <Flex justifyContent="space-between" alignItems="center" gap="xs" flex="1">
                        <Text lineClamp={1} textOverflow="ellipsis" textStyle="label/M/regular">
                          {shortcut.actionLabel}
                        </Text>
                        <Flex justifyContent="flex-end" alignItems="center" gap="xs" color="fg.menu-item.default">
                          <ShortcutKbd binding={shortcut.binding} />
                        </Flex>
                      </Flex>
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Root>
            </ScrollArea>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
