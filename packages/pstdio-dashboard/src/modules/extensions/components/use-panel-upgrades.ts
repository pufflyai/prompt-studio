import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { useToaster } from "@pstdio/ui";
import { createExtensionUpgradePool } from "pstdio-api-contracts/extension-host";
import { useTranslation } from "react-i18next";
import type { useActionError } from "@/shared/components/use-action-error";
import { useUpgradeProjectExtension } from "@/shared/extensions/use-project-extensions";
import { usePanelUpgradeState } from "./panel-upgrade-state";

export const usePanelUpgrades = (
  projectId: string | undefined,
  capacity: number | undefined,
  showError: ReturnType<typeof useActionError>["showError"],
  clearError: () => void,
) => {
  const toaster = useToaster();
  const { t } = useTranslation("projects");
  const upgrade = useUpgradeProjectExtension(projectId);
  const { state, snapshot } = usePanelUpgradeState(projectId);
  const queuedInstanceIds = [...snapshot].filter(([, status]) => status === "queued").map(([id]) => id);
  const upgradingInstanceIds = [...snapshot.keys()];
  // A batch uses the capacity of the API host, which can be on a different device.
  const handleUpgradeAll = async (upgradable: ProjectExtensionInstance[]) => {
    clearError();
    const pending = upgradable.filter(({ id }) => state.claim(id));
    const run = createExtensionUpgradePool(capacity);
    let upgraded = 0;
    const failed: string[] = [];
    await Promise.all(
      pending.map(async (extension) => {
        try {
          await upgrade.mutateAsync({
            instanceId: extension.id,
            schedule: (send) =>
              run(() => {
                state.set(extension.id, "running");
                return send();
              }),
          });
          upgraded += 1;
        } catch (error) {
          failed.push(`${extension.displayName}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          state.set(extension.id);
        }
      }),
    );
    if (upgraded > 0) {
      toaster.create({
        type: "success",
        title: t("projectSettings.extensionsPanel.upgradeAll.succeeded", { count: upgraded }),
      });
    }
    if (failed.length > 0) {
      showError({
        title: t("projectSettings.extensionsPanel.upgradeAll.failed", { count: failed.length }),
        description: failed.join("\n"),
      });
    }
  };

  // Each row upgrades on its own, so several upgrades can run at once and each reports its own result.
  const handleUpgrade = async (extension: ProjectExtensionInstance, surface: "list" | "detail") => {
    clearError();
    if (!state.claim(extension.id)) return;
    state.set(extension.id, "running");
    try {
      const result = await upgrade.mutateAsync({ instanceId: extension.id });
      // The detail already displays the confirmed version beside its navigation controls.
      if (surface === "detail") return;
      toaster.create({
        type: "success",
        title: t(
          result.changed
            ? "projectSettings.extensionsPanel.upgrade.succeeded"
            : "projectSettings.extensionsPanel.upgrade.current",
        ),
      });
    } catch (error) {
      showError({
        title: t("projectSettings.extensionsPanel.upgrade.failed"),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      state.set(extension.id);
    }
  };

  return { handleUpgrade, handleUpgradeAll, upgradingInstanceIds, queuedInstanceIds };
};
