import { Button, HStack } from "@chakra-ui/react";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { AlertMessage, toaster } from "@pstdio/ui";
import { ArrowUpCircle, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { loadErrorClipboardText, loadErrorField } from "./extension-load-error";

export interface ExtensionDetailHealthProps {
  extension: ProjectExtensionInstance;
  upgrading?: boolean;
  onUpgrade: () => void;
}

export const ExtensionDetailHealth = (props: ExtensionDetailHealthProps) => {
  const { extension, upgrading, onUpgrade } = props;
  const { t } = useTranslation("projects");
  const code = loadErrorField(extension.lastError, "code");
  const incompatible = code === "extension_manifest_unsupported_api_version";

  const copyError = async () => {
    await navigator.clipboard.writeText(loadErrorClipboardText(extension.lastError));
    toaster.create({ type: "success", title: t("projectSettings.extensionsPanel.health.errorCopied") });
  };

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
        <HStack gap="xs" flexShrink="0">
          {extension.canUpgrade && (
            <Button
              variant="primary"
              size="2xs"
              onClick={onUpgrade}
              loading={upgrading}
              data-testid="extension-health-upgrade"
            >
              <ArrowUpCircle size={12} />
              {t("projectSettings.extensionsPanel.upgrade.action")}
            </Button>
          )}
          <Button variant="ghost" size="2xs" onClick={() => void copyError()} data-testid="extension-copy-error">
            <Copy size={12} />
            {t("projectSettings.extensionsPanel.health.copyError")}
          </Button>
        </HStack>
      }
    >
      {loadErrorField(extension.lastError, "message") ?? t("projectSettings.extensionsPanel.health.unknownError")}
      {extension.lastLoadedAt
        ? ` · ${t("projectSettings.extensionsPanel.health.lastLoaded", {
            time: new Date(extension.lastLoadedAt).toLocaleString(),
          })}`
        : ""}
    </AlertMessage>
  );
};
