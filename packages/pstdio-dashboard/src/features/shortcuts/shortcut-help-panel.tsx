import { Button, CloseButton, Dialog, Flex, Stack, Text } from "@chakra-ui/react";
import { ShortcutKbd } from "./shortcut-kbd";
import { SHORTCUT_DEFINITIONS } from "./shortcut-registry";

const scopeLabel = {
  global: "Global dashboard",
  ticket: "Ticket contexts",
  workspace: "Workspace contexts",
  overlay: "Overlay contexts",
} as const;

export const ShortcutHelpPanel = (props: { open: boolean; onClose: () => void }) => {
  const { open, onClose } = props;

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="42rem">
          <Dialog.Header>
            <Stack gap="2xs" flex="1">
              <Text textStyle="heading/S">Keyboard Shortcuts</Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                Sequential shortcuts: press the first key, then the second.
              </Text>
            </Stack>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="xs">
              {SHORTCUT_DEFINITIONS.map((shortcut) => (
                <Flex
                  key={shortcut.id}
                  align="center"
                  justify="space-between"
                  gap="sm"
                  px="sm"
                  py="xs"
                  borderWidth="1px"
                  borderColor="border.muted"
                  borderRadius="md"
                >
                  <Stack gap="2xs" minW="0">
                    <Text textStyle="label/M/medium">{shortcut.actionLabel}</Text>
                    <Text textStyle="label/XS/regular" color="fg.muted">
                      {scopeLabel[shortcut.scope]}
                    </Text>
                  </Stack>
                  <Flex align="center" justify="flex-end" textAlign="right">
                    <ShortcutKbd binding={shortcut.binding} />
                  </Flex>
                </Flex>
              ))}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
