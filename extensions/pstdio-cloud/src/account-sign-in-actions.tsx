import { CloseButton, Stack } from "@chakra-ui/react";
import type { AccountSignInProvider, AccountStatus } from "@pstdio/sdk/extensions";
import { ScopedDialog as Dialog, Portal } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";
import { GoogleIcon, MicrosoftIcon } from "./sign-in-provider-icons";

interface AccountSignInActionsProps {
  pending: boolean;
  busy?: boolean;
  disabled?: boolean;
  signIn(provider: AccountSignInProvider): void;
  cancel(): void;
}

export const AccountSignInActions = (props: AccountSignInActionsProps) => {
  const { pending, busy, disabled: unavailable, signIn, cancel } = props;
  const { t } = useCloudContext();
  const [open, setOpen] = useState(false);
  const disabled = unavailable || busy;
  const choose = (provider: AccountSignInProvider) => {
    setOpen(false);
    signIn(provider);
  };
  if (pending) {
    return (
      <Button size="sm" variant="outline" disabled={disabled} onClick={cancel}>
        {t("account.cancelLogin", "Cancel sign-in")}
      </Button>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={({ open }) => setOpen(open)} size="sm" placement="center">
      <Dialog.Trigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          {t("account.signIn", "Sign in")}
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{t("account.signIn", "Sign in")}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" aria-label={t("account.closeSignIn", "Close sign-in")} />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="sm">
                <Button variant="outline" disabled={disabled} justifyContent="start" onClick={() => choose("google")}>
                  <GoogleIcon />
                  {t("account.signInGoogle", "Sign in with Google")}
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  justifyContent="start"
                  onClick={() => choose("microsoft")}
                >
                  <MicrosoftIcon />
                  {t("account.signInMicrosoft", "Sign in with Microsoft")}
                </Button>
              </Stack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export const AccountSignInNotice = (props: { attempt?: AccountStatus["loginAttempt"]; actionError?: string }) => {
  const { attempt, actionError } = props;
  const { t } = useCloudContext();
  if (actionError) return <CloudError key="action" inline message={actionError} />;
  if (attempt?.status !== "failed") return null;
  let message = t("account.loginFailed", "Sign-in did not complete. Sign in to try again.");
  if (attempt.error === "provider-unavailable")
    message = t("account.providerUnavailable", "This Cloud service has not enabled that sign-in provider.");
  if (attempt.error === "provider-denied")
    message = t("account.providerDenied", "Sign-in was declined. Check your provider’s consent policy and retry.");
  return <CloudError key={attempt.id} inline message={message} />;
};
