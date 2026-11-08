import { Button, HStack, Progress, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { ExtensionActionFeedback, type ExtensionActionState } from "./extension-action-feedback";

export default { title: "Proposals/PS-149 Extension upgrades" };
export const UpgradeFeedback = () => {
  const [status, setStatus] = useState<ExtensionActionState["status"]>("running");
  const labels = {
    queued: "Queued for upgrade",
    running: "Upgrading Project Planner",
    success: "Extension upgraded",
    error: "Could not upgrade extension",
  };
  return (
    <Stack padding="lg" gap="md">
      <HStack>
        {(["queued", "running", "success", "error"] as const).map((value) => (
          <Button key={value} size="sm" variant="outline" onClick={() => setStatus(value)}>
            {value}
          </Button>
        ))}
      </HStack>
      <Text textStyle="heading/M">Extensions</Text>
      <Text textStyle="label/S/medium">1 of 3 upgrades finished · Project Planner upgrading</Text>
      <Progress.Root value={1} max={3} size="xs" aria-label="Extension upgrades">
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
      <Stack borderBottomWidth="1px" borderColor="border.subtle" paddingY="sm" gap="xs">
        <Text textStyle="label/S/medium">Project Planner · v0.4.2</Text>
        <Text textStyle="label/XS" color="fg.muted">
          Plan and track tickets across workspaces.
        </Text>
        <ExtensionActionFeedback
          action={{
            status,
            label: labels[status],
            startedAt: Date.now() - 12000,
            finishedAt: status === "running" ? undefined : Date.now(),
            error: "The registry could not be reached.",
          }}
          onRetry={() => setStatus("running")}
          onDismiss={() => setStatus("queued")}
        />
      </Stack>
      <Text textStyle="label/S/medium">Notes</Text>
      <ExtensionActionFeedback action={{ status: "queued", label: "Queued for upgrade" }} />
    </Stack>
  );
};
