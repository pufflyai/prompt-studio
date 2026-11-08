import { Progress, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { ExtensionActionFeedback, type ExtensionActionState } from "./extension-action-feedback";

interface ExtensionUpgradeProgressProps {
  batch?: { ids: string[]; startedAt: number; finishedAt?: number };
  actions: Record<string, ExtensionActionState>;
}
export const ExtensionUpgradeProgress = (props: ExtensionUpgradeProgressProps) => {
  const { batch, actions } = props;
  const { t } = useTranslation("projects");
  if (!batch?.ids.length) return null;
  const ids = batch.ids;
  const entries = ids.flatMap((id) => (actions[id] ? [actions[id]!] : []));
  const pending = entries.filter(({ status }) => status === "queued" || status === "running");
  const completed = ids.length - pending.length;
  const label = t("projectSettings.extensionsPanel.feedback.batch", { count: completed, total: ids.length });
  return (
    <Stack gap="xs" data-testid="extension-upgrade-progress">
      <ExtensionActionFeedback
        progress={false}
        action={{
          status: batch.finishedAt === undefined ? "running" : "success",
          label,
          startedAt: batch.startedAt,
          finishedAt: batch.finishedAt,
        }}
      />
      <Progress.Root value={completed} max={ids.length} size="xs" aria-label={label}>
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
      {pending
        .filter(({ status }) => status === "running")
        .map((action) => (
          <Text key={action.label} textStyle="label/XS" color="fg.muted">
            {action.label}
          </Text>
        ))}
    </Stack>
  );
};
