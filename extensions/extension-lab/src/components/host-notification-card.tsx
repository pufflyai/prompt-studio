import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { executeSayHelloCommand, getProjectIdFromSearch } from "../counter-api";
import { buildHostCommandOutcomeToastMessages } from "../host-bridge";
import { LabCard } from "./lab-card";

export const HostNotificationCard = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectId = getProjectIdFromSearch(window.location.search);

  const sayHello = async () => {
    if (!projectId || isPending) return;

    setIsPending(true);
    setError(null);

    try {
      const response = await executeSayHelloCommand({ projectId });
      for (const message of buildHostCommandOutcomeToastMessages("Lab: Say hello", response.outcome)) {
        window.parent.postMessage(message, window.location.origin);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <LabCard title="Host notification" subtitle="Run a command that emits a dashboard toast.">
      <Stack gap="md">
        <Button type="button" variant="solid" onClick={sayHello} disabled={isPending || !projectId} alignSelf="start">
          {isPending ? "Sending..." : "Say hello"}
        </Button>
        {error ? (
          <Text textStyle="paragraph/S/regular" color="fg.error">
            {error}
          </Text>
        ) : null}
      </Stack>
    </LabCard>
  );
};
