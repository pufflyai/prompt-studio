import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionActionState } from "./extension-action-feedback";
import type { ExtensionUpgradeBatch } from "./extension-actions";

interface ExtensionUpgradeProgressProps {
  batch?: ExtensionUpgradeBatch;
  onUpgrade: () => void;
  onDismiss?: (batch: ExtensionUpgradeBatch) => void;
  upgradeCount: number;
  compact?: boolean;
}

/** The batch owns its counts: dismissing a row result cannot rewrite the batch outcome. */
export const ExtensionUpgradeProgress = (props: ExtensionUpgradeProgressProps) => {
  const { batch, onUpgrade, onDismiss, upgradeCount, compact } = props;
  const { t } = useTranslation("projects");
  useEffect(() => {
    if (batch && !batch.running && upgradeCount < 2) onDismiss?.(batch);
  }, [batch, upgradeCount, onDismiss]);
  if (!batch?.running && upgradeCount < 2) return null;
  const outcomes: string[] = [];
  if (batch?.reviewRequired)
    outcomes.push(t("projectSettings.extensionsPanel.feedback.batchReviewRequired", { count: batch.reviewRequired }));
  if (batch?.failed)
    outcomes.push(
      t("projectSettings.extensionsPanel.feedback.batchFailed", { count: batch.failed, total: batch.ids.length }),
    );
  const action: ExtensionActionState | undefined = batch
    ? {
        status: batch.running ? "running" : "error",
        label: batch.running
          ? t("projectSettings.extensionsPanel.feedback.batch", { count: batch.completed, total: batch.ids.length })
          : outcomes.join(" · "),
      }
    : undefined;
  return (
    <ExtensionActionButton
      variant="primary"
      size={compact ? "xs" : "sm"}
      compact={compact}
      data-testid="extensions-upgrade-all"
      action={action}
      progress={batch ? { value: batch.completed, max: batch.ids.length, label: action!.label } : undefined}
      onAction={onUpgrade}
      onRetry={upgradeCount > 1 ? onUpgrade : undefined}
      retryLabel={t("projectSettings.extensionsPanel.upgradeAll.action")}
      onDismiss={() => batch && onDismiss?.(batch)}
      disabled={upgradeCount < 2}
    >
      {t("projectSettings.extensionsPanel.upgradeAll.action")}
    </ExtensionActionButton>
  );
};
