import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Download } from "lucide-react";
import { useState } from "react";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionActionState } from "./extension-action-feedback";
import { ExtensionUpgradeProgress } from "./extension-upgrade-progress";

export default { title: "ProjectSettings/Extension action feedback" };
export const UpgradeFeedback = () => {
  const [status, setStatus] = useState<ExtensionActionState["status"] | undefined>("running");
  const [install, setInstall] = useState(false);
  const [completed, setCompleted] = useState(1);
  const [showBatch, setShowBatch] = useState(true);
  const labels = {
    queued: "Waiting",
    running: install ? "Installing" : "Upgrading",
    success: install ? "Installed" : "Upgraded",
    error: install ? "Install failed" : "Upgrade failed",
  };
  return (
    <Stack padding="lg" gap="md">
      <HStack>
        {(["queued", "running", "success", "error"] as const).map((value) => (
          <Button key={value} onClick={() => setStatus(value)}>
            {value}
          </Button>
        ))}
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
                  label: labels[status],
                  startedAt: status === "queued" ? undefined : Date.now() - 12000,
                  finishedAt: status === "success" || status === "error" ? Date.now() : undefined,
                  error: status === "error" ? "Registry unavailable" : undefined,
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
