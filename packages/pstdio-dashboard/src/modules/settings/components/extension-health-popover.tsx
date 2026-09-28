import { Button, HStack, Icon, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import type { ExtensionDiagnostic, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { ArrowUpCircle, CircleAlert, Copy, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { loadErrorClipboardText, loadErrorField } from "./extension-load-error";

export interface ExtensionHealthPopoverProps {
  extension: ProjectExtensionInstance;
  diagnostics: ExtensionDiagnostic[];
  upgrading?: boolean;
  onUpgrade?: () => void;
}

export const ExtensionHealthPopover = (props: ExtensionHealthPopoverProps) => {
  const { extension, diagnostics, upgrading, onUpgrade } = props;
  const { t } = useTranslation("projects");

  // Red is reserved for a real load failure; a loaded extension's diagnostics are
  // surfaced as issues, whatever their severity.
  const failed = extension.status === "error";
  const issues = diagnostics.filter((diagnostic) => diagnostic.severity !== "info");
  const count = failed ? 1 + issues.length : issues.length;
  const errorCode = loadErrorField(extension.lastError, "code");
  const errorTitle =
    errorCode === "extension_manifest_unsupported_api_version"
      ? t("projectSettings.extensionsPanel.health.incompatibleVersions")
      : errorCode;

  const copyError = async () => {
    await navigator.clipboard.writeText(loadErrorClipboardText(extension.lastError));
    toaster.create({ type: "success", title: t("projectSettings.extensionsPanel.health.errorCopied") });
  };

  if (count === 0) return null;

  const palette = failed ? "fg.error" : "fg.warning";

  return (
    <Popover.Root positioning={{ placement: "bottom-end" }}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="2xs"
          color={palette}
          gap="2xs"
          data-testid="extension-health-trigger"
          aria-label={t("projectSettings.extensionsPanel.health.triggerAriaLabel", { name: extension.displayName })}
        >
          <Icon boxSize="3.5">{failed ? <CircleAlert /> : <TriangleAlert />}</Icon>
          <Text textStyle="label/XS" fontFamily="mono">
            {count}
          </Text>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="320px" data-testid="extension-health-popover">
            <Popover.Body padding="0">
              <Stack gap="0">
                <HStack paddingX="md" paddingY="sm" borderBottomWidth="1px" borderColor="border.subtle" gap="xs">
                  <Icon boxSize="3.5" color={palette}>
                    {failed ? <CircleAlert /> : <TriangleAlert />}
                  </Icon>
                  <Text textStyle="label/S/medium">
                    {failed
                      ? t("projectSettings.extensionsPanel.health.failedToLoad")
                      : t("projectSettings.extensionsPanel.health.issues", { count })}
                  </Text>
                  {extension.lastLoadedAt && (
                    <Text textStyle="label/XS" color="fg.subtle" marginLeft="auto">
                      {t("projectSettings.extensionsPanel.health.lastLoaded", {
                        time: new Date(extension.lastLoadedAt).toLocaleTimeString(),
                      })}
                    </Text>
                  )}
                </HStack>

                <Stack paddingX="md" paddingY="sm" gap="2xs">
                  {failed && (
                    <>
                      {errorTitle && (
                        <Text textStyle="label/XS" fontFamily="mono" color="fg.error">
                          {errorTitle}
                        </Text>
                      )}
                      <Text textStyle="label/XS" color="fg.muted">
                        {loadErrorField(extension.lastError, "message") ??
                          t("projectSettings.extensionsPanel.health.unknownError")}
                      </Text>
                    </>
                  )}
                  {issues.slice(0, 4).map((diagnostic, index) => (
                    <Text key={`${diagnostic.code}-${index}`} textStyle="label/XS" color="fg.muted">
                      {diagnostic.code}: {diagnostic.message}
                    </Text>
                  ))}
                </Stack>

                {failed && (
                  <HStack paddingX="md" paddingY="sm" borderTopWidth="1px" borderColor="border.subtle" gap="xs">
                    {extension.canUpgrade && onUpgrade && (
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
                    <Button
                      variant="ghost"
                      size="2xs"
                      onClick={() => void copyError()}
                      data-testid="extension-copy-error"
                    >
                      <Copy size={12} />
                      {t("projectSettings.extensionsPanel.health.copyError")}
                    </Button>
                  </HStack>
                )}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
