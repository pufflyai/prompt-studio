import { useTranslation } from "react-i18next";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionActionState } from "./extension-action-feedback";
import type { ExtensionUpgradeBatch } from "./extension-actions";

interface ExtensionUpgradeProgressProps {
  batch?: ExtensionUpgradeBatch;
  onUpgrade: () => void;
  onDismiss?: (batch: ExtensionUpgradeBatch) => void;
  canUpgrade: boolean;
}

/** The batch owns its counts: dismissing a row result cannot rewrite the batch outcome. */
export const ExtensionUpgradeProgress = (props: ExtensionUpgradeProgressProps) => {
  const { batch, onUpgrade, onDismiss, canUpgrade } = props;
  const { t } = useTranslation("projects");
  const finished = batch?.finishedAt !== undefined;
  let action: ExtensionActionState | undefined;
  if (batch) {
    action = {
      status: "running",
      label: t("projectSettings.extensionsPanel.feedback.batch", { count: batch.completed, total: batch.ids.length }),
      startedAt: batch.startedAt,
      finishedAt: batch.finishedAt,
    };
    if (finished) {
      action.status = batch.failed > 0 ? "error" : "success";
      if (batch.failed > 0)
        action.label = t("projectSettings.extensionsPanel.feedback.batchFailed", {
          count: batch.failed,
          total: batch.ids.length,
        });
    }
    if (batch.failed > 0)
      action.error = t("projectSettings.extensionsPanel.feedback.batchFailed", {
        count: batch.failed,
        total: batch.ids.length,
      });
  }
  return (
    <ExtensionActionButton
      variant="primary"
      size="sm"
      data-testid="extensions-upgrade-all"
      action={action}
      progress={batch ? { value: batch.completed, max: batch.ids.length, label: action!.label } : undefined}
      onAction={onUpgrade}
      onRetry={canUpgrade ? onUpgrade : undefined}
      retryLabel={t("projectSettings.extensionsPanel.upgradeAll.action")}
      onDismiss={() => batch && onDismiss?.(batch)}
      disabled={!canUpgrade}
    >
      {t("projectSettings.extensionsPanel.upgradeAll.action")}
    </ExtensionActionButton>
  );
};
