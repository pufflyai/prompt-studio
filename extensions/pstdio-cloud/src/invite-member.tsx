import { CloseButton, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CreatedTeamInviteCode } from "@pstdio/sdk/extensions";
import { CopyButton, ScopedDialog as Dialog, Portal } from "@pstdio/ui";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";

interface InviteMemberProps {
  invitation?: CreatedTeamInviteCode;
  busy: boolean;
  error?: string;
  clearError: () => void;
  retry: () => void;
  revoke: () => void;
  close: () => void;
}

export const InviteMember = (props: InviteMemberProps) => {
  const { invitation, busy, error, clearError, retry, revoke, close } = props;
  const { t } = useCloudContext();
  return (
    <Dialog.Root open onOpenChange={({ open }) => !open && close()} size="sm" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{t("members.invite", "Invite member")}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="md" position="relative">
                <Text color="fg.muted">
                  {t("members.shareCode", "Share this code. They can accept it in Prompt Studio.")}
                </Text>
                {invitation && (
                  <>
                    <HStack gap="sm">
                      <Input aria-label={t("members.code", "Team invite code")} value={invitation.code} readOnly />
                      <CopyButton text={invitation.code} label={t("members.copyCode", "Copy invite code")} />
                    </HStack>
                    <Text textStyle="label/S/regular" color="fg.muted">
                      {t("members.expires", "Expires {{date}}", {
                        date: new Date(invitation.expiresAt).toLocaleString(),
                      })}
                    </Text>
                  </>
                )}
                {!invitation && busy && <Text role="status">{t("members.creatingCode", "Creating invite code…")}</Text>}
                {!invitation && !busy && (
                  <Button size="sm" variant="outline" alignSelf="start" onClick={retry}>
                    {t("members.createCode", "Create invite code")}
                  </Button>
                )}
                {error && <CloudError inline message={error} onClose={clearError} />}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer justifyContent="space-between">
              <Button variant="destructive-ghost" disabled={busy || !invitation} onClick={revoke}>
                {t("members.revokeCode", "Revoke invite")}
              </Button>
              <Button variant="primary" onClick={close}>
                {t("members.done", "Done")}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
