import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { ExtensionConnectionRecord, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import {
  useCheckExtensionConnection,
  useConfigureExtensionConnection,
  useDeleteExtensionConnection,
  useExtensionConnections,
} from "../data/use-extension-connections";

type ConnectionDefinition = NonNullable<WorkbenchExtensionMetadata["connections"]>[number];

interface ExtensionConnectionRowProps {
  projectId: string;
  definition: ConnectionDefinition;
  configured: ExtensionConnectionRecord | undefined;
}

const ExtensionConnectionRow = (props: ExtensionConnectionRowProps) => {
  const { projectId, definition, configured } = props;
  const { t } = useTranslation("projects");
  const configure = useConfigureExtensionConnection(projectId);
  const check = useCheckExtensionConnection(projectId);
  const remove = useDeleteExtensionConnection(projectId);
  const [baseUrl, setBaseUrl] = useState("");
  const [secret, setSecret] = useState("");

  useEffect(() => {
    setBaseUrl(configured?.baseUrl ?? "");
  }, [configured?.baseUrl]);

  const connectionInput = { extensionId: definition.extensionId, connectionId: definition.localId };
  const notifyError = (error: Error) =>
    toaster.create({
      type: "error",
      title: t("projectSettings.extensionsPanel.connections.actionFailed"),
      description: error.message,
    });
  const handleConfigure = () => {
    configure.mutate(
      { ...connectionInput, baseUrl, secret: secret || undefined },
      {
        onSuccess: () => {
          setSecret("");
          toaster.create({ type: "success", title: t("projectSettings.extensionsPanel.connections.saved") });
        },
        onError: notifyError,
      },
    );
  };

  return (
    <Stack gap="sm" borderWidth="1px" borderColor="border.subtle" borderRadius="md" padding="md">
      <Stack gap="0">
        <Text textStyle="label/S/medium">{resolveLocalizableString(definition.label, definition.extensionId)}</Text>
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
          disabled={!baseUrl || (!configured?.configured && !secret)}
          loading={configure.isPending}
        >
          {configured?.configured
            ? t("projectSettings.extensionsPanel.connections.reconnect")
            : t("projectSettings.extensionsPanel.connections.connect")}
        </Button>
        {definition.supportsCheck && (
          <Button
            size="2xs"
            variant="outline"
            disabled={!configured?.configured}
            loading={check.isPending}
            onClick={() => check.mutate(connectionInput, { onError: notifyError })}
          >
            {t("projectSettings.extensionsPanel.connections.check")}
          </Button>
        )}
        {configured?.configured && (
          <Button
            size="2xs"
            variant="destructive"
            loading={remove.isPending}
            onClick={() => remove.mutate(connectionInput, { onError: notifyError })}
          >
            {t("projectSettings.extensionsPanel.connections.revoke")}
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
      {definitions.map((definition) => (
        <ExtensionConnectionRow
          key={definition.id}
          projectId={projectId}
          definition={definition}
          configured={connections.data?.connections.find(
            (connection) =>
              connection.extensionId === definition.extensionId && connection.connectionId === definition.localId,
          )}
        />
      ))}
    </Stack>
  );
};
