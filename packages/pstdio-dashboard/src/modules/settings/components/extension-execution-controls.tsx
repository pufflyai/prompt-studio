import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { ExtensionExecution } from "@pstdio/sdk/api";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ExtensionExecutionControlsProps {
  execution: ExtensionExecution;
  pending?: boolean;
  error?: string;
  onAction: (action: "stop" | "restart") => Promise<unknown>;
}

const executionState = (execution: ExtensionExecution) => {
  if (execution.stopped) return "stopped";
  if (execution.owners.some((owner) => owner.state === "starting")) return "starting";
  if (execution.owners.some((owner) => owner.state === "failed")) return "failed";
  if (execution.owners.some((owner) => owner.pendingCalls > 0)) return "running";
  return "ready";
};

export const ExtensionExecutionControls = (props: ExtensionExecutionControlsProps) => {
  const { execution, pending, error, onAction } = props;
  const { t } = useTranslation("projects");
  const [confirming, setConfirming] = useState<"stop" | "restart">();
  if (!execution.available) return null;
  const state = executionState(execution);
  const status = () => {
    if (error || state === "failed") return "error" as const;
    if (confirming || state === "stopped") return "warning" as const;
    return "info" as const;
  };
  const confirm = async () => {
    if (!confirming) return;
    try {
      await onAction(confirming);
      setConfirming(undefined);
    } catch {
      // The operation's error remains beside these controls.
    }
  };
  return (
    <AlertMessage
      status={status()}
      title={t(`projectSettings.extensionsPanel.execution.${state}`)}
      data-testid="extension-execution-controls"
      endElement={
        <HStack gap="2xs" flexWrap="wrap">
          {confirming ? (
            <>
              <Button disabled={pending} onClick={() => setConfirming(undefined)}>
                {t("projectSettings.extensionsPanel.execution.cancel")}
              </Button>
              <Button loading={pending} onClick={() => void confirm()}>
                {t(`projectSettings.extensionsPanel.execution.confirm.${confirming}`)}
              </Button>
            </>
          ) : (
            <>
              {!execution.stopped && (
                <Button onClick={() => setConfirming("stop")}>
                  {t("projectSettings.extensionsPanel.execution.stop")}
                </Button>
              )}
              <Button onClick={() => setConfirming("restart")}>
                {t("projectSettings.extensionsPanel.execution.restart")}
              </Button>
            </>
          )}
        </HStack>
      }
    >
      <Stack gap="xs" aria-live="polite">
        {confirming && (
          <>
            <Text>
              {t("projectSettings.extensionsPanel.execution.impact", {
                projects: execution.affectedProjects.map((project) => project.name).join(", "),
              })}
            </Text>
            <Text>{t("projectSettings.extensionsPanel.execution.retained")}</Text>
          </>
        )}
        {error && <Text role="alert">{error}</Text>}
      </Stack>
    </AlertMessage>
  );
};
