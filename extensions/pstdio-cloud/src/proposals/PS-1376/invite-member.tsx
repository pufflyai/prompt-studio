import { CloseButton, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { CopyButton, ScopedDialog as Dialog, Portal } from "@pstdio/ui";
import { Button } from "../../button";
import type { TeamDemo } from "./demo-model";

interface InviteMemberProps {
  demo: TeamDemo;
  open: boolean;
  onClose: () => void;
}

export const InviteMember = (props: InviteMemberProps) => {
  const { demo, open, onClose } = props;
  return (
    <Dialog.Root open={open} onOpenChange={({ open }) => !open && onClose()} size="sm" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Invite member</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="md">
                <Text color="fg.muted">Share this code. They can accept it in Prompt Studio.</Text>
                <HStack gap="sm">
                  <Input aria-label="Team invite code" value={demo.invitation ?? ""} readOnly />
                  <CopyButton text={demo.invitation ?? ""} label="Copy invite code" />
                </HStack>
                <Text textStyle="label/S/regular" color="fg.muted">
                  Expires in 24 hours
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer justifyContent="space-between">
              <Button
                variant="destructive-ghost"
                onClick={() => {
                  demo.revoke();
                  onClose();
                }}
              >
                Revoke invite
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
