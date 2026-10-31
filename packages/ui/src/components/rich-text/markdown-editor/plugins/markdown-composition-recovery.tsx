import { Button, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { useState, useSyncExternalStore } from "react";
import type { createMarkdownSessionDocument } from "../../shared/markdown-session-document";

interface MarkdownCompositionRecoveryProps {
  binding: ReturnType<typeof createMarkdownSessionDocument>;
}

/** Matches Public text sessions / Lifecycle And Recovery, committed and presented before adoption. */
export const MarkdownCompositionRecovery = (props: MarkdownCompositionRecoveryProps) => {
  const { binding } = props;
  const [discardError, setDiscardError] = useState(false);
  const failure = useSyncExternalStore(binding.subscribeRecovery, binding.failure, binding.failure);
  const failed = Boolean(failure);
  return (
    <Stack gap="xs" bg="bg.muted" px="sm" py="xs">
      <Flex gap="sm" align="center" justify="space-between">
        <Flex gap="xs" align="center">
          {!failed && <Spinner size="xs" color="fg.muted" aria-label="Draft waiting" />}
          <Text color="fg.muted" textStyle="label/S/regular">
            {failed ? "Your draft is kept here." : "Your draft is waiting to be saved."}
          </Text>
        </Flex>
        <Flex gap="xs">
          <Button size="2xs" variant="ghost" onClick={() => setDiscardError(!binding.cancelComposition())}>
            Discard draft
          </Button>
          <Button
            size="2xs"
            variant="subtle"
            onClick={() => {
              setDiscardError(false);
              void Promise.resolve(binding.retry()).catch(() => {});
            }}
          >
            Retry
          </Button>
        </Flex>
      </Flex>
      {discardError && (
        <Text textStyle="label/S/regular" color="fg.error">
          Wait for this save before discarding the draft.
        </Text>
      )}
    </Stack>
  );
};
