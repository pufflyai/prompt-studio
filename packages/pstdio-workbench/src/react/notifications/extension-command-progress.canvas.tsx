import { Button, HStack, Stack } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import { OperationProgressIndicator } from "./operation-recovery";

export default { title: "Workbench/Feedback/Extension command progress" };

export const PublicationProgress = () => {
  const [phase, setPhase] = useState<"idle" | "pending" | "unknown">("idle");
  return (
    <Stack width="36rem" minHeight="12rem" gap="sm">
      <HStack>
        <Button size="sm" disabled={phase !== "idle"} onClick={() => setPhase("pending")}>
          Publish artifact
        </Button>
        <Button size="sm" disabled={phase !== "pending"} onClick={() => setPhase("idle")}>
          Confirm publication
        </Button>
        <Button size="sm" disabled={phase !== "pending"} onClick={() => setPhase("unknown")}>
          Lose response
        </Button>
      </HStack>
      {phase === "pending" && <OperationProgressIndicator title="Publish artifact" />}
      {phase === "unknown" && (
        <AlertMessage compact status="error" title="Publish artifact" onClose={() => setPhase("idle")}>
          Publication could not be confirmed. Inspect the artifact before discarding this attempt.
        </AlertMessage>
      )}
    </Stack>
  );
};
