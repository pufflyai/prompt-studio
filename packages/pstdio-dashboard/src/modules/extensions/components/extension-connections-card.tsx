import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { ExtensionConnectionRecord, SavedExtensionSignIn } from "@pstdio/sdk/api";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { useActionError } from "@/shared/components/use-action-error";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import {
  type ConnectionDefinition,
  findSavedExtensionSignIn,
  useExtensionConnectionActions,
  useExtensionConnections,
} from "../data/use-extension-connections";

import { ExtensionOAuthConnectionRow } from "./extension-oauth-connection-row";

interface ExtensionConnectionRowProps {
  projectId: string;
  definition: ConnectionDefinition;
  configured: ExtensionConnectionRecord | undefined;
  savedSignIns: SavedExtensionSignIn[] | undefined;
}

const ExtensionConnectionRow = (props: ExtensionConnectionRowProps) => {
  const { projectId, definition, configured, savedSignIns } = props;
  const { showError, errorNotice, clearError } = useActionError();
  const { t } = useTranslation("projects");
  const connection = useExtensionConnectionActions(projectId, definition);
  const [draftUrl, setBaseUrl] = useState<string>();
  const baseUrl = draftUrl ?? configured?.baseUrl ?? "";
  const [secret, setSecret] = useState("");
  const savedSignIn = findSavedExtensionSignIn(savedSignIns, definition, configured?.baseUrl);

  const notifyError = (error: Error) =>
    showError({
      title: t("projectSettings.extensionsPanel.connections.actionFailed"),
      description: error.message,
    });
  const handleConfigure = () => {
    clearError();
    void connection.run({ action: "configure", baseUrl, secret: secret || undefined }).then(() => {
      setSecret("");
      setBaseUrl(undefined);
    }, notifyError);
  };

  return (
    <Stack position="relative" gap="sm" borderWidth="1px" borderColor="border.subtle" borderRadius="md" padding="md">
      {errorNotice}
      <Stack gap="0">
        <Text textStyle="label/S/medium">
          {resolveLocalizableString(
            definition.label,
            definition.extensionId,
            undefined,
            getRuntimeCollections(),
            projectId,
          )}
        </Text>
        {definition.scope === "global" && (
          <Text textStyle="label/XS" color="fg.muted">
            {t("projectSettings.extensionsPanel.connections.globalScope")}
          </Text>
        )}

        <Text textStyle="label/XS" color={configured?.configured ? "fg.success" : "fg.muted"}>
          {configured?.configured
            ? t("projectSettings.extensionsPanel.connections.connected")
            : t("projectSettings.extensionsPanel.connections.notConnected")}
          {configured?.lastCheck
            ? ` · ${t(
                configured.lastCheck.ok
                  ? "projectSettings.extensionsPanel.connections.lastCheckOk"
                  : "projectSettings.extensionsPanel.connections.lastCheckFailed",
                { status: configured.lastCheck.status ?? "—" },
              )}`
            : ""}
        </Text>
      </Stack>

      <Stack gap="2xs">
        <Text textStyle="label/XS/medium">{t("projectSettings.extensionsPanel.connections.endpoint")}</Text>
        <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://" />
      </Stack>
      <Stack gap="2xs">
        <Text textStyle="label/XS/medium">{t("projectSettings.extensionsPanel.connections.credential")}</Text>
        <Input
          value={secret}
          type="password"
          onChange={(event) => setSecret(event.target.value)}
          placeholder={
            configured?.configured
              ? t("projectSettings.extensionsPanel.connections.credentialUnchanged")
              : t("projectSettings.extensionsPanel.connections.credentialRequired")
          }
        />
      </Stack>

      <HStack gap="xs" flexWrap="wrap">
        <Button
          size="2xs"
          onClick={handleConfigure}
          disabled={connection.busy || !baseUrl || (!configured?.configured && !secret)}
          loading={connection.phase === "configure"}
        >
          {configured?.configured
            ? t("projectSettings.extensionsPanel.connections.reconnect")
            : t("projectSettings.extensionsPanel.connections.connect")}
        </Button>
        {definition.supportsCheck && (
          <Button
            size="2xs"
            variant="outline"
            disabled={connection.busy || !configured?.configured}
            loading={connection.phase === "check"}
            onClick={() => {
              clearError();
              void connection.run({ action: "check" }).catch(notifyError);
            }}
          >
            {t("projectSettings.extensionsPanel.connections.check")}
          </Button>
        )}
        {configured?.configured && definition.scope !== "global" && (
          <Button
            size="2xs"
            variant="outline"
            loading={connection.phase === "disconnect"}
            disabled={connection.busy}
            onClick={() => {
              clearError();
              void connection.run({ action: "disconnect" }).catch(notifyError);
            }}
          >
            {t("projectSettings.extensionsPanel.connections.disconnectProject")}
          </Button>
        )}
        {savedSignIn && (
          <Button
            size="2xs"
            variant="destructive"
            loading={connection.phase === "revoke"}
            disabled={connection.busy}
            onClick={() => {
              clearError();
              void connection.run({ action: "revoke", baseUrl: savedSignIn.origin }).catch(notifyError);
            }}
          >
            {definition.scope === "global"
              ? t("projectSettings.extensionsPanel.connections.revokeSignIn")
              : t("projectSettings.extensionsPanel.connections.revokeSharedSignIn")}
          </Button>
        )}
      </HStack>
    </Stack>
  );
};

export const ExtensionConnectionsCard = (props: { projectId: string; definitions: ConnectionDefinition[] }) => {
  const { projectId, definitions } = props;
  const { t } = useTranslation("projects");
  const connections = useExtensionConnections(projectId);

  return (
    <Stack gap="sm">
      <Stack gap="0">
        <Text textStyle="label/S/medium">{t("projectSettings.extensionsPanel.connections.title")}</Text>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {t("projectSettings.extensionsPanel.connections.description")}
        </Text>
      </Stack>
      {definitions.map((definition) => {
        const key = JSON.stringify([connections.authority, projectId, definition.id]);
        if (definition.authType === "oauth")
          return (
            <ExtensionOAuthConnectionRow
              key={key}
              projectId={projectId}
              definition={definition}
              authority={connections.authority}
            />
          );
        return (
          <ExtensionConnectionRow
            key={key}
            projectId={projectId}
            definition={definition}
            savedSignIns={connections.data?.savedSignIns}
            configured={connections.data?.connections.find(
              (connection) =>
                connection.extensionId === definition.extensionId && connection.connectionId === definition.localId,
            )}
          />
        );
      })}
    </Stack>
  );
};
