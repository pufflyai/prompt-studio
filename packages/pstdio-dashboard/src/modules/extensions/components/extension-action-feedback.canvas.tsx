import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionActionState } from "./extension-action-feedback";
import { ExtensionUpgradeProgress } from "./extension-upgrade-progress";

export default { title: "ProjectSettings/Extension action feedback" };
export const UpgradeFeedback = () => {
  const [status, setStatus] = useState<ExtensionActionState["status"] | undefined>("running");
  const [completed, setCompleted] = useState(1);
  const [showBatch, setShowBatch] = useState(true);
  const labels = {
    queued: "Queued for upgrade",
    running: "Upgrading",
    success: "Extension upgraded",
    error: "Upgrade failed",
  };
  return (
    <Stack padding="lg" gap="md">
      <HStack>
        {(["queued", "running", "success", "error"] as const).map((value) => (
          <Button key={value} size="sm" variant="outline" onClick={() => setStatus(value)}>
            {value}
          </Button>
        ))}
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
            showBatch
              ? {
                  ids: ["planner", "notes", "tickets"],
                  startedAt: Date.now() - 12000,
                  completed,
                  failed: status === "error" ? 1 : 0,
                  finishedAt: completed === 3 ? Date.now() : undefined,
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
          <Text textStyle="label/S/medium">Project Planner · v0.4.2</Text>
          <Text textStyle="label/XS" color="fg.muted">
            Plan and track tickets across workspaces.
          </Text>
        </Stack>
        <ExtensionActionButton
          size="2xs"
          action={
            status
              ? {
                  status,
                  label: labels[status],
                  startedAt: status === "queued" ? undefined : Date.now() - 12000,
                  finishedAt: status === "success" || status === "error" ? Date.now() : undefined,
                  error: status === "error" ? "The registry could not be reached." : undefined,
                }
              : undefined
          }
          onAction={() => setStatus("running")}
          onRetry={() => setStatus("running")}
          onDismiss={() => setStatus(undefined)}
        >
          Upgrade
        </ExtensionActionButton>
      </HStack>
    </Stack>
  );
};
