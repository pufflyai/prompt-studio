import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { ExtensionOAuthStatus } from "@pstdio/sdk/extensions";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

const key = "projectSettings.extensionsPanel.connections";
const statuses = {
  authorizing: "oauthAuthorizing",
  connected: "connected",
  disconnected: "notConnected",
  reconnect_required: "oauthReconnectRequired",
} as const;

interface OAuthConnectionControlsProps {
  label: string;
  status: ExtensionOAuthStatus["status"] | undefined;
  busy?: "connect" | "disconnect";
  authorizationUrl?: string;
  error?: ReactNode;
  failed?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRetry?: () => void;
}

export const ExtensionOAuthConnectionControls = (props: OAuthConnectionControlsProps) => {
  const { label, status, busy, authorizationUrl, error, failed, onConnect, onDisconnect, onRetry } = props;
  const { t } = useTranslation("projects");
  const connected = status === "connected";
  const authorizing = status === "authorizing";
  return (
    <Stack position="relative" gap="sm" borderWidth="1px" borderColor="border.subtle" borderRadius="md" padding="md">
      {error}
      <Stack gap="0">
        <Text textStyle="label/S/medium">{label}</Text>
        {status && (
          <Text role="status" textStyle="label/XS" color={connected ? "fg.success" : "fg.muted"}>
            {t(`${key}.${statuses[status]}`)}
          </Text>
        )}
        {failed && <Text textStyle="label/XS">{t(`${key}.oauthStatusFailed`)}</Text>}
      </Stack>
      <HStack gap="xs" flexWrap="wrap">
        {failed && (
          <Button size="2xs" variant="outline" onClick={onRetry}>
            {t("opening.retry")}
          </Button>
        )}
        {!failed && !connected && !(authorizing && authorizationUrl) && (
          <Button size="2xs" disabled={!status || Boolean(busy)} loading={busy === "connect"} onClick={onConnect}>
            {t(`${key}.${status === "reconnect_required" ? "reconnect" : "connect"}`)}
          </Button>
        )}
        {authorizing && authorizationUrl && (
          <Button size="2xs" asChild>
            <a href={authorizationUrl} target="_blank" rel="noopener noreferrer">
              {t(`${key}.openProviderSignIn`)}
            </a>
          </Button>
        )}
        {(connected || authorizing || status === "reconnect_required") && (
          <Button
            size="2xs"
            variant="outline"
            disabled={Boolean(busy)}
            loading={busy === "disconnect"}
            onClick={onDisconnect}
          >
            {t(`${key}.${authorizing ? "oauthCancel" : "oauthDisconnect"}`)}
          </Button>
        )}
      </HStack>
    </Stack>
  );
};
