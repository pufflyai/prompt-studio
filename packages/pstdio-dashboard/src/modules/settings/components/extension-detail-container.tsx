import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { Checkbox, DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";
import {
  useAttemptExtensionFix,
  useExtensionContributions,
  useProjectExtensionSettings,
  useReloadProjectExtension,
  useSetExtensionAutomationEnabled,
  useSetProjectExtensionEnabled,
  useUninstallProjectExtension,
  useUpdateProjectExtensionSetting,
} from "@/shared/extensions/use-project-extensions";
import { ExtensionDetail } from "./extension-detail";

interface ExtensionDetailContainerProps {
  projectId: string | undefined;
  extension: ProjectExtensionInstance;
  metadata: DashboardExtensionMetadata | undefined;
  onBack: () => void;
}

export const ExtensionDetailContainer = (props: ExtensionDetailContainerProps) => {
  const { projectId, extension, metadata, onBack } = props;
  const { t } = useTranslation("projects");
  const setEnabled = useSetProjectExtensionEnabled(projectId);
  const setAutomationEnabled = useSetExtensionAutomationEnabled(projectId);
  const settingsQuery = useProjectExtensionSettings(projectId, extension.id);
  // The per-extension endpoint documents contributions even while the extension
  // is disabled, unlike the workbench metadata which only covers enabled ones.
  const contributionsQuery = useExtensionContributions(projectId, extension.id);
  const updateSetting = useUpdateProjectExtensionSetting(projectId);
  const reload = useReloadProjectExtension(projectId);
  const attemptFix = useAttemptExtensionFix(projectId);
  const uninstall = useUninstallProjectExtension(projectId);
  const [confirmingUninstall, setConfirmingUninstall] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState(false);

  const contributions = contributionsQuery.data;
  const automations = (contributions?.automations ?? []).filter(
    (automation) => automation.extensionId === extension.extensionId,
  );
  const diagnostics = (metadata?.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.extensionId === extension.extensionId,
  );

  const handleRetry = () => {
    reload.mutate(
      { instanceId: extension.id },
      {
        onSuccess: (updated) => {
          toaster.create(
            updated.status === "loaded"
              ? { type: "success", title: t("projectSettings.extensionsPanel.health.retrySucceeded") }
              : { type: "error", title: t("projectSettings.extensionsPanel.health.retryFailed") },
          );
        },
      },
    );
  };

  const handleAttemptFix = () => {
    attemptFix.mutate(
      { instanceId: extension.id },
      {
        onSuccess: (response) => {
          toaster.create({
            type: "success",
            title: t("projectSettings.extensionsPanel.health.fixSessionStarted"),
            description: response.title,
          });
        },
        onError: (error) => {
          toaster.create({
            type: "error",
            title: t("projectSettings.extensionsPanel.health.fixSessionFailed"),
            description: error instanceof Error ? error.message : undefined,
          });
        },
      },
    );
  };

  const handleUninstall = async () => {
    try {
      await uninstall.mutateAsync({ instanceId: extension.id, deleteUserData });
      onBack();
    } catch (error) {
      toaster.create({
        type: "error",
        title: t("projectSettings.extensionsPanel.deleteErrorTitle"),
        description: error instanceof Error ? error.message : t("projectSettings.extensionsPanel.deleteError"),
      });
      throw error;
    }
  };

  return (
    <>
      <ExtensionDetail
        extension={extension}
        metadata={contributions}
        automations={automations}
        diagnostics={diagnostics}
        settings={settingsQuery.data?.settings ?? []}
        toggling={setEnabled.isPending}
        retrying={reload.isPending}
        fixing={attemptFix.isPending}
        uninstalling={uninstall.isPending}
        togglingAutomationId={
          setAutomationEnabled.isPending ? (setAutomationEnabled.variables?.automationId ?? undefined) : undefined
        }
        onBack={onBack}
        onToggle={(enabled) => setEnabled.mutate({ instanceId: extension.id, enabled })}
        onToggleAutomation={(automation, enabled) =>
          setAutomationEnabled.mutate({ instanceId: extension.id, automationId: automation.id, enabled })
        }
        onChangeSetting={(key, value) => updateSetting.mutate({ instanceId: extension.id, key, value })}
        onRetry={handleRetry}
        onAttemptFix={handleAttemptFix}
        onUninstall={() => setConfirmingUninstall(true)}
      />
      <DeleteConfirmationModal
        open={confirmingUninstall}
        onClose={() => {
          setConfirmingUninstall(false);
          setDeleteUserData(false);
        }}
        onDelete={handleUninstall}
        headline={t("projectSettings.extensionsPanel.deleteConfirm.headline")}
        notificationText={t("projectSettings.extensionsPanel.deleteConfirm.notification", {
          name: extension.displayName,
        })}
        buttonText={t("projectSettings.extensionsPanel.deleteConfirm.button")}
      >
        <Checkbox checked={deleteUserData} onCheckedChange={(details) => setDeleteUserData(details.checked === true)}>
          {t("projectSettings.extensionsPanel.deleteConfirm.deleteDataLabel")}
        </Checkbox>
      </DeleteConfirmationModal>
    </>
  );
};
