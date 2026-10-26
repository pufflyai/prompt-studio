import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { Checkbox, DeleteConfirmationModal, toaster } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import type { AgentInfo } from "pstdio-api-contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useActionError } from "@/shared/components/use-action-error";
import { executeExtensionCommandValue } from "@/shared/extensions/api";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";
import {
  useExtensionContributions,
  useProjectExtensionSettings,
  useReloadProjectExtension,
  useSetExtensionAutomationEnabled,
  useSetProjectExtensionEnabled,
  useUninstallProjectExtension,
  useUpdateProjectExtensionSetting,
  useUpgradeProjectExtension,
} from "@/shared/extensions/use-project-extensions";
import { ExtensionDetail } from "./extension-detail";
import { ExtensionExecutionSection } from "./extension-execution-section";
import { unavailableExtensionHarnesses } from "./extension-harness-availability";
import { ExtensionSettingsViews } from "./extension-settings-views";

interface ExtensionDetailContainerProps {
  projectId: string | undefined;
  extension: ProjectExtensionInstance;
  metadata: DashboardExtensionMetadata | undefined;
  agents?: AgentInfo[];
  onBack: () => void;
  settingsInput?: WorkbenchPanelRenderInput;
}

export const ExtensionDetailContainer = (props: ExtensionDetailContainerProps) => {
  const { projectId, extension, metadata, agents, onBack, settingsInput } = props;
  const { showError, errorNotice, clearError } = useActionError();
  const settingsPanels =
    metadata?.settingsPanels.filter(
      (panel) => panel.extensionId === extension.extensionId && panel.slot.id === "extension.settings",
    ) ?? [];
  const { t } = useTranslation("projects");
  const setEnabled = useSetProjectExtensionEnabled(projectId);
  const setAutomationEnabled = useSetExtensionAutomationEnabled(projectId);
  const settingsQuery = useProjectExtensionSettings(projectId, extension.id);
  // The per-extension endpoint documents contributions even while the extension
  // is disabled, unlike the workbench metadata which only covers enabled ones.
  const contributionsQuery = useExtensionContributions(projectId, extension.id);
  const updateSetting = useUpdateProjectExtensionSetting(projectId);
  const reload = useReloadProjectExtension(projectId);
  const upgrade = useUpgradeProjectExtension(projectId);
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

  // Reloading validates the source waiting on disk, then adopts it.
  const handleReload = () => {
    clearError();
    reload.mutate(
      { instanceId: extension.id },
      {
        onSuccess: (updated) => {
          if (updated.status === "loaded")
            toaster.create({ type: "success", title: t("projectSettings.extensionsPanel.reload.succeeded") });
          else showError({ title: t("projectSettings.extensionsPanel.reload.failed") });
        },
        onError: (error) =>
          showError({ title: t("projectSettings.extensionsPanel.reload.failed"), description: error.message }),
      },
    );
  };

  const handleUpgrade = () => {
    clearError();
    upgrade.mutate(
      { instanceId: extension.id },
      {
        onSuccess: (result) => {
          toaster.create({
            type: "success",
            title: t(
              result.changed
                ? "projectSettings.extensionsPanel.upgrade.succeeded"
                : "projectSettings.extensionsPanel.upgrade.current",
            ),
          });
        },
        onError: (error) => {
          showError({
            title: t("projectSettings.extensionsPanel.upgrade.failed"),
            description: error instanceof Error ? error.message : undefined,
          });
        },
      },
    );
  };

  const handleUninstall = async () => {
    clearError();
    try {
      await uninstall.mutateAsync({ instanceId: extension.id, deleteUserData });
      onBack();
    } catch (error) {
      showError({
        title: t("projectSettings.extensionsPanel.deleteErrorTitle"),
        description: error instanceof Error ? error.message : t("projectSettings.extensionsPanel.deleteError"),
      });
      throw error;
    }
  };

  return (
    <>
      {!confirmingUninstall && errorNotice}
      <ExtensionDetail
        projectId={projectId}
        extension={extension}
        metadata={contributions}
        unavailableHarnesses={unavailableExtensionHarnesses(
          extension,
          contributionsQuery.isSuccess ? contributions?.harnesses : undefined,
          agents,
        )}
        automations={automations}
        diagnostics={diagnostics}
        settings={settingsQuery.data?.settings ?? []}
        executionControls={
          projectId ? <ExtensionExecutionSection projectId={projectId} instanceId={extension.id} /> : undefined
        }
        settingsViews={
          settingsInput && settingsPanels.length ? (
            <ExtensionSettingsViews input={settingsInput} panels={settingsPanels} />
          ) : undefined
        }
        toggling={setEnabled.isPending}
        reloading={reload.isPending}
        upgrading={upgrade.isPending}
        uninstalling={uninstall.isPending}
        togglingAutomationId={
          setAutomationEnabled.isPending ? (setAutomationEnabled.variables?.automationId ?? undefined) : undefined
        }
        onBack={onBack}
        onToggle={(enabled) => {
          clearError();
          setEnabled.mutate(
            { instanceId: extension.id, enabled },
            { onError: (error) => showError({ title: error.message }) },
          );
        }}
        onToggleAutomation={(automation, enabled) =>
          setAutomationEnabled.mutate(
            { instanceId: extension.id, automationId: automation.id, enabled },
            { onError: (error) => showError({ title: error.message }) },
          )
        }
        executeOptionCommand={(commandId, params, signal) => {
          if (!projectId) return Promise.reject(new Error("Setting options need a project."));
          return executeExtensionCommandValue(projectId, commandId, params, signal);
        }}
        onChangeSetting={(key, value) => {
          clearError();
          updateSetting.mutate(
            { instanceId: extension.id, key, value },
            { onError: (error) => showError({ title: error.message }) },
          );
        }}
        onReload={handleReload}
        onUpgrade={handleUpgrade}
        onUninstall={() => {
          clearError();
          setConfirmingUninstall(true);
        }}
      />
      <DeleteConfirmationModal
        open={confirmingUninstall}
        onClose={() => {
          setConfirmingUninstall(false);
          setDeleteUserData(false);
        }}
        onDelete={handleUninstall}
        headline={t("projectSettings.extensionsPanel.deleteConfirm.headline")}
        notificationText={t(
          extension.scope === "global"
            ? "projectSettings.extensionsPanel.deleteConfirm.notificationShared"
            : "projectSettings.extensionsPanel.deleteConfirm.notification",
          { name: extension.displayName },
        )}
        buttonText={t("projectSettings.extensionsPanel.deleteConfirm.button")}
      >
        {errorNotice}
        <Checkbox checked={deleteUserData} onCheckedChange={(details) => setDeleteUserData(details.checked === true)}>
          {t("projectSettings.extensionsPanel.deleteConfirm.deleteDataLabel")}
        </Checkbox>
      </DeleteConfirmationModal>
    </>
  );
};
