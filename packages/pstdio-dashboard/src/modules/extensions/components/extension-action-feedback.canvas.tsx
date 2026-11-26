import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Download } from "lucide-react";
import { useState } from "react";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionActionState } from "./extension-action-feedback";
import { ExtensionUpgradeProgress } from "./extension-upgrade-progress";

export default { title: "ProjectSettings/Extension action feedback" };
const feedbackError = (status: ExtensionActionState["status"], conflict: boolean) => {
  if (status !== "error") return undefined;
  return conflict ? "This extension has local changes and could not be updated." : "Registry unavailable";
};
export const UpgradeFeedback = () => {
  const [status, setStatus] = useState<ExtensionActionState["status"] | undefined>("running");
  const [install, setInstall] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [completed, setCompleted] = useState(1);
  const [showBatch, setShowBatch] = useState(true);
  const conflict = !install && needsReview && status === "error";
  const labels = {
    queued: "Waiting",
    running: install ? "Installing" : "Upgrading",
    error: install ? "Install failed" : "Upgrade failed",
  };
  return (
    <Stack padding="lg" gap="md">
      <HStack>
        {(["queued", "running", "error"] as const).map((value) => (
          <Button key={value} onClick={() => setStatus(value)}>
            {value}
          </Button>
        ))}
        <Button onClick={() => setStatus(undefined)}>Idle</Button>
        <Button
          onClick={() => {
            setNeedsReview((value) => !value);
            setStatus("error");
            setInstall(false);
          }}
        >
          Toggle conflict
        </Button>
        <Button onClick={() => setInstall((value) => !value)}>Toggle fresh install</Button>
        <Button
          onClick={() => {
            setShowBatch(true);
            setCompleted((value) => (value + 1) % 4);
          }}
        >
          Advance batch
        </Button>
      </HStack>
      <HStack justifyContent="space-between">
        <Text textStyle="heading/M">Extensions</Text>
        <ExtensionUpgradeProgress
          batch={
            showBatch && (completed < 3 || status === "error")
              ? {
                  ids: ["planner", "notes", "tickets"],
                  completed,
                  failed: status === "error" && !conflict ? 1 : 0,
                  reviewRequired: Number(conflict),
                  running: completed < 3,
                }
              : undefined
          }
          onUpgrade={() => {
            setShowBatch(true);
            setCompleted(0);
          }}
          onDismiss={() => setShowBatch(false)}
          canUpgrade
        />
      </HStack>
      <HStack borderBottomWidth="1px" borderColor="border.subtle" paddingY="sm" gap="md">
        <Stack flex="1" gap="0">
          <Text textStyle="label/S/medium">{install ? "Pi" : "Project Planner"}</Text>
          <Text textStyle="label/XS" color="fg.muted">
            {install ? "Available extension" : "Installed extension"}
          </Text>
        </Stack>
        <ExtensionActionButton
          size="2xs"
          icon={install ? <Download /> : undefined}
          action={
            status
              ? {
                  status,
                  needsReview: conflict,
                  label: conflict ? "Update paused" : labels[status],
                  error: feedbackError(status, conflict),
                }
              : undefined
          }
          onAction={() => setStatus("running")}
          onRetry={() => setStatus("running")}
          onDismiss={() => setStatus(undefined)}
        >
          {install ? "Install" : "Upgrade"}
        </ExtensionActionButton>
      </HStack>
      <HStack justifyContent="space-between">
        <Text textStyle="label/S/medium">Notes</Text>
        <ExtensionActionButton size="2xs" action={{ status: "queued", label: "Waiting" }}>
          Upgrade
        </ExtensionActionButton>
      </HStack>
    </Stack>
  );
};

export const InstallOutcomeUnconfirmed = () => (
  <Stack padding="lg" gap="md" align="flex-start">
    <Text textStyle="heading/M">Notes</Text>
    <ExtensionActionButton
      size="sm"
      action={{
        status: "error",
        label: "Outcome unconfirmed",
        error: "Inspect Extensions or discard this attempt in System activity.",
        retryable: false,
      }}
      onRetry={() => {}}
      onDismiss={() => {}}
    >
      Install
    </ExtensionActionButton>
  </Stack>
);
