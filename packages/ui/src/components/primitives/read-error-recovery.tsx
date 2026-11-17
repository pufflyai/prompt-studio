import { Box, Button, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { ActionErrorSlot } from "./action-error-slot";
import { AlertMessage } from "./alert";

interface ReadErrorRecoveryProps {
  title: string;
  error?: string;
  retry: () => void;
  retryLabel?: string;
}

/** A failed initial read has no content to anchor feedback to, so it owns its recovery space. */
export const ReadErrorRecovery = ({ title, error, retry, retryLabel = "Retry" }: ReadErrorRecoveryProps) => {
  const [attempt, setAttempt] = useState(0);
  return (
    <Stack gap="2xs" align="start" w="full">
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          setAttempt((value) => value + 1);
          retry();
        }}
      >
        {retryLabel}
      </Button>
      <Box position="relative" w="full" minH="5rem">
        <ActionErrorSlot edge="top">
          <AlertMessage key={attempt} compact status="error" maxH="4rem" title={title}>
            {error}
          </AlertMessage>
        </ActionErrorSlot>
      </Box>
    </Stack>
  );
};
