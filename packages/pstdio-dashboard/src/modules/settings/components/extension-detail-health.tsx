import { Button, HStack } from "@chakra-ui/react";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { AlertMessage } from "@pstdio/ui";
import { RotateCw, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ExtensionDetailHealthProps {
  extension: ProjectExtensionInstance;
  retrying?: boolean;
  fixing?: boolean;
  onRetry: () => void;
  onAttemptFix: () => void;
}

const errorText = (error: Record<string, unknown> | null | undefined, key: "code" | "message") => {
  const value = error?.[key];
  return typeof value === "string" ? value : undefined;
};

export const ExtensionDetailHealth = (props: ExtensionDetailHealthProps) => {
  const { extension, retrying, fixing, onRetry, onAttemptFix } = props;
  const { t } = useTranslation("projects");
  const code = errorText(extension.lastError, "code");
  const incompatible = code === "extension_manifest_unsupported_api_version";
  // A catalog extension is repaired by the Upgrade action in the header. Any other source is fixed
  // where it lives, so retrying it after the fix, or asking an agent to fix it, are the ways forward.
  const repairedByUpgrade = incompatible && extension.canUpgrade;

  return (
    <AlertMessage
      status="error"
      title={
        incompatible
          ? t("projectSettings.extensionsPanel.health.incompatibleVersions")
          : (code ?? t("projectSettings.extensionsPanel.status.error"))
      }
      data-testid="extension-detail-health"
      endElement={
        repairedByUpgrade ? undefined : (
          <HStack gap="xs" flexShrink="0">
            <Button variant="outline" size="2xs" onClick={onRetry} loading={retrying} data-testid="extension-retry">
              <RotateCw size={12} />
              {t("projectSettings.extensionsPanel.health.retry")}
            </Button>
            <Button
              variant="ghost"
              size="2xs"
              onClick={onAttemptFix}
              loading={fixing}
              data-testid="extension-attempt-fix"
            >
              <Wrench size={12} />
              {t("projectSettings.extensionsPanel.health.attemptFix")}
            </Button>
          </HStack>
        )
      }
    >
      {errorText(extension.lastError, "message") ?? t("projectSettings.extensionsPanel.health.unknownError")}
      {extension.lastLoadedAt
        ? ` · ${t("projectSettings.extensionsPanel.health.lastLoaded", {
            time: new Date(extension.lastLoadedAt).toLocaleString(),
          })}`
        : ""}
    </AlertMessage>
  );
};
