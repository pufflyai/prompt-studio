import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { SavedExtensionSignIn } from "@pstdio/sdk/api";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useActionError } from "@/shared/components/use-action-error";
import { useExtensionConnectionActions, useExtensionConnections } from "../data/use-extension-connections";

const SavedSignInRow = ({ projectId, signIn }: { projectId: string; signIn: SavedExtensionSignIn }) => {
  const { t } = useTranslation("projects");
  const { showError, errorNotice, clearError } = useActionError();
  const descriptionId = useId();
  const global = signIn.signInScope === "global";
  const connection = useExtensionConnectionActions(projectId, {
    extensionId: signIn.extensionId,
    localId: signIn.connectionId,
    scope: global ? "global" : "project",
  });
  const revoke = () => {
    clearError();
    void connection.run({ action: "revoke", baseUrl: signIn.origin }).catch((error: Error) =>
      showError({
        title: t("projectSettings.extensionsPanel.connections.actionFailed"),
        description: error.message,
      }),
    );
  };

  return (
    <HStack position="relative" justify="space-between" gap="sm" flexWrap="wrap">
      {errorNotice}
      <Stack id={descriptionId} gap="0" minW="0" overflowWrap="anywhere">
        <Text textStyle="label/S/medium">
          {signIn.extensionId} / {signIn.connectionId}
        </Text>
        <Text textStyle="label/XS" color="fg.muted">
          {signIn.origin}
        </Text>
      </Stack>
      <Button
        size="2xs"
        variant="destructive"
        aria-describedby={descriptionId}
        loading={connection.phase === "revoke"}
        disabled={connection.busy}
        onClick={revoke}
      >
        {t(
          global
            ? "projectSettings.extensionsPanel.connections.revokeSignIn"
            : "projectSettings.extensionsPanel.connections.revokeSharedSignIn",
        )}
      </Button>
    </HStack>
  );
};

export const SavedExtensionSignIns = ({ projectId }: { projectId: string }) => {
  const { t } = useTranslation("projects");
  const headingId = useId();
  const { data, authority } = useExtensionConnections(projectId);
  if (!data?.savedSignIns?.length) return null;

  return (
    <Stack as="section" aria-labelledby={headingId} padding="lg" gap="md">
      <Text as="h2" id={headingId} textStyle="label/S/medium">
        {t("projectSettings.extensionsPanel.connections.savedSignIns")}
      </Text>
      {data.savedSignIns.map((signIn) => (
        <SavedSignInRow
          key={JSON.stringify([
            authority,
            projectId,
            signIn.extensionId,
            signIn.connectionId,
            signIn.origin,
            signIn.signInScope,
          ])}
          projectId={projectId}
          signIn={signIn}
        />
      ))}
    </Stack>
  );
};
