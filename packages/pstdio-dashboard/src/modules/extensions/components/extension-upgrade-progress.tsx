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
  const failure = batch?.failed
    ? t("projectSettings.extensionsPanel.feedback.batchFailed", { count: batch.failed, total: batch.ids.length })
    : undefined;
  const action: ExtensionActionState | undefined = batch
    ? {
        status: batch.running ? "running" : "error",
        label: batch.running
          ? t("projectSettings.extensionsPanel.feedback.batch", { count: batch.completed, total: batch.ids.length })
          : failure!,
        error: failure,
      }
    : undefined;
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
