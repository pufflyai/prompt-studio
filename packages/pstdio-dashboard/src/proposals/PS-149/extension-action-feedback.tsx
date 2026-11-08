import { Button, HStack, Progress, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export interface ExtensionActionState {
  status: "queued" | "running" | "success" | "error";
  label: string;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}
interface ExtensionActionFeedbackProps {
  action?: ExtensionActionState;
  onDismiss?: () => void;
  onRetry?: () => void;
}
export const ExtensionActionFeedback = (props: ExtensionActionFeedbackProps) => {
  const { action, onDismiss, onRetry } = props;
  const { t } = useTranslation("projects");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (action?.status !== "running") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [action?.status]);
  if (!action) return null;
  const elapsed =
    action.startedAt === undefined
      ? undefined
      : Math.max(0, Math.floor(((action.finishedAt ?? now) - action.startedAt) / 1000));
  const label = elapsed === undefined ? action.label : `${action.label} · ${elapsed}s`;
  if (action.status === "error")
    return (
      <AlertMessage status="error" role="alert" title={label} onClose={onDismiss}>
        <Stack gap="xs">
          <Text>{action.error}</Text>
          {onRetry && (
            <Button size="2xs" variant="outline" onClick={onRetry}>
              {t("projectSettings.extensionsPanel.feedback.retry", "Retry")}
            </Button>
          )}
        </Stack>
      </AlertMessage>
    );
  return (
    <Stack gap="xs" role="status" aria-live="polite" aria-atomic="true">
      <HStack gap="sm">
        <Text textStyle="label/XS" color={action.status === "success" ? "fg.success" : "fg.muted"}>
          {label}
        </Text>
        {action.status === "success" && onDismiss && (
          <Button size="2xs" variant="ghost" onClick={onDismiss}>
            {t("projectSettings.extensionsPanel.feedback.dismiss", "Dismiss")}
          </Button>
        )}
      </HStack>
      {action.status === "running" && (
        <Progress.Root value={null} size="xs" aria-label={action.label}>
          <Progress.Track>
            <Progress.Range />
          </Progress.Track>
        </Progress.Root>
      )}
    </Stack>
  );
};
