import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import type { ExtensionDiagnostic, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { Checkbox, DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useProjectExtensionMetadata,
  useProjectExtensions,
  useSetProjectExtensionEnabled,
  useUninstallProjectExtension,
} from "@/shared/extensions/use-project-extensions";
import { ExtensionRow } from "./extension-row";

interface ExtensionsPanelProps {
  projectId: string | undefined;
}

interface ExtensionsPanelViewProps {
  extensions: ProjectExtensionInstance[];
  diagnostics: ExtensionDiagnostic[];
  togglingInstanceId?: string;
  uninstallingInstanceId?: string;
  onToggle?: (extension: ProjectExtensionInstance, enabled: boolean) => void;
  onUninstall?: (extension: ProjectExtensionInstance) => void;
}

const severityColor: Record<ExtensionDiagnostic["severity"], string> = {
  error: "fg.error",
  info: "fg.muted",
  warning: "orange.800",
};

export const ExtensionsPanelView = (props: ExtensionsPanelViewProps) => {
  const { extensions, diagnostics, togglingInstanceId, uninstallingInstanceId, onToggle, onUninstall } = props;
  const { t } = useTranslation("projects");

  return (
    <Stack padding="lg" gap="lg" data-testid="extensions-panel">
      {diagnostics.length > 0 && (
        <Stack gap="sm" data-testid="extension-diagnostics">
          <Text textStyle="label/S" color="fg.muted">
            {t("projectSettings.extensionsPanel.diagnostics")}
          </Text>
          {diagnostics.map((diagnostic, index) => (
            <Stack
              key={`${diagnostic.code}:${diagnostic.message}:${diagnostic.extensionId ?? "project"}:${diagnostic.sourcePath ?? index}`}
              gap="xs"
              borderWidth="1px"
              borderColor="border.muted"
              borderRadius="md"
              padding="md"
              data-testid="extension-diagnostic"
            >
              <Text textStyle="paragraph/S/medium" color={severityColor[diagnostic.severity]}>
                {diagnostic.severity.toUpperCase()}
              </Text>
              <Text textStyle="paragraph/S/regular">{diagnostic.message}</Text>
              {(diagnostic.extensionId || diagnostic.sourcePath) && (
                <Text textStyle="paragraph/XS/regular" color="fg.muted">
                  {[diagnostic.extensionId, diagnostic.sourcePath].filter(Boolean).join(" | ")}
                </Text>
              )}
            </Stack>
          ))}
        </Stack>
      )}

      {extensions.length === 0 && (
        <Text textStyle="paragraph/S/regular" color="fg.muted" data-testid="extensions-empty">
          {t("projectSettings.extensionsPanel.empty")}
        </Text>
      )}

      {extensions.map((extension) => (
        <ExtensionRow
          key={extension.id}
          extension={extension}
          toggling={togglingInstanceId === extension.id}
          uninstalling={uninstallingInstanceId === extension.id}
          toggleAriaLabel={t("projectSettings.extensionsPanel.toggleAriaLabel", { name: extension.displayName })}
          uninstallLabel={t("projectSettings.extensionsPanel.uninstall")}
          onToggle={(enabled) => onToggle?.(extension, enabled)}
          onUninstall={() => onUninstall?.(extension)}
        />
      ))}
    </Stack>
  );
};

export const ExtensionsPanel = (props: ExtensionsPanelProps) => {
  const { projectId } = props;
  const { t } = useTranslation("projects");
  const extensionsQuery = useProjectExtensions(projectId);
  const metadataQuery = useProjectExtensionMetadata(projectId);
  const setEnabled = useSetProjectExtensionEnabled(projectId);
  const uninstall = useUninstallProjectExtension(projectId);
  const [uninstallTarget, setUninstallTarget] = useState<ProjectExtensionInstance | null>(null);
  const [deleteUserData, setDeleteUserData] = useState(false);

  const closeUninstallConfirm = () => {
    setUninstallTarget(null);
    setDeleteUserData(false);
  };

  if (extensionsQuery.isLoading) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Spinner />
      </Flex>
    );
  }

  if (extensionsQuery.error) {
    return (
      <Stack padding="lg" gap="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {extensionsQuery.error instanceof Error
            ? extensionsQuery.error.message
            : t("projectSettings.extensionsPanel.loadError")}
        </Text>
      </Stack>
    );
  }

  const handleToggle = (extension: ProjectExtensionInstance, enabled: boolean) => {
    setEnabled.mutate(
      { instanceId: extension.id, enabled },
      {
        onError: (error) => {
          const message = error instanceof Error ? error.message : t("projectSettings.extensionsPanel.toggleError");
          toaster.create({
            type: "error",
            title: t("projectSettings.extensionsPanel.toggleErrorTitle"),
            description: message,
          });
        },
      },
    );
  };

  const handleUninstall = async () => {
    if (!uninstallTarget) return;
    try {
      await uninstall.mutateAsync({ instanceId: uninstallTarget.id, deleteUserData });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("projectSettings.extensionsPanel.uninstallError");
      toaster.create({
        type: "error",
        title: t("projectSettings.extensionsPanel.uninstallErrorTitle"),
        description: message,
      });
      throw error;
    }
  };

  return (
    <>
      <ExtensionsPanelView
        extensions={extensionsQuery.data?.extensions ?? []}
        diagnostics={metadataQuery.data?.diagnostics ?? []}
        togglingInstanceId={setEnabled.isPending ? (setEnabled.variables?.instanceId ?? undefined) : undefined}
        uninstallingInstanceId={uninstall.isPending ? (uninstall.variables?.instanceId ?? undefined) : undefined}
        onToggle={handleToggle}
        onUninstall={(extension) => setUninstallTarget(extension)}
      />
      <DeleteConfirmationModal
        open={Boolean(uninstallTarget)}
        onClose={closeUninstallConfirm}
        onDelete={handleUninstall}
        headline={t("projectSettings.extensionsPanel.uninstallConfirm.headline")}
        notificationText={t("projectSettings.extensionsPanel.uninstallConfirm.notification", {
          name: uninstallTarget?.displayName ?? "",
        })}
        buttonText={t("projectSettings.extensionsPanel.uninstallConfirm.button")}
      >
        <Checkbox checked={deleteUserData} onCheckedChange={(details) => setDeleteUserData(details.checked === true)}>
          {t("projectSettings.extensionsPanel.uninstallConfirm.deleteDataLabel")}
        </Checkbox>
      </DeleteConfirmationModal>
    </>
  );
};
