import { HStack } from "@chakra-ui/react";
import type { AccountSignInProvider, AccountStatus } from "@pstdio/sdk/extensions";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";

export const AccountSignInActions = (props: {
  pending: boolean;
  busy?: boolean;
  disabled?: boolean;
  signIn(provider: AccountSignInProvider): void;
  cancel(): void;
}) => {
  const { t } = useCloudContext();
  const disabled = props.disabled || props.busy;
  if (props.pending) {
    return (
      <Button size="sm" variant="outline" disabled={disabled} onClick={props.cancel}>
        {t("account.cancelLogin", "Cancel sign-in")}
      </Button>
    );
  }
  return (
    <HStack gap="xs" flexWrap="wrap">
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => props.signIn("google")}>
        {t("account.signInGoogle", "Sign in with Google")}
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => props.signIn("microsoft")}>
        {t("account.signInMicrosoft", "Sign in with Microsoft")}
      </Button>
    </HStack>
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
