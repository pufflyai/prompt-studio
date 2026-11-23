import { Button, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";

export default { title: "Proposals/PS-289 Extension command progress" };

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
      {phase === "pending" && (
        <HStack role="status" gap="xs">
          <Spinner size="xs" />
          <Text textStyle="label/XS/medium">Publish artifact</Text>
        </HStack>
      )}
      {phase === "unknown" && (
        <AlertMessage compact status="error" title="Publish artifact" onClose={() => setPhase("idle")}>
          Publication could not be confirmed. Inspect the artifact before discarding this attempt.
        </AlertMessage>
      )}
    </Stack>
  );
};
