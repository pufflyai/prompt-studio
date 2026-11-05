import { Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { createMarkdownSessionDocument } from "../../shared/markdown-session-document";

interface MarkdownCompositionRecoveryProps {
  binding: ReturnType<typeof createMarkdownSessionDocument>;
}

/** Matches Public text sessions / Lifecycle And Recovery, committed and presented before adoption. */
export const MarkdownCompositionRecovery = (props: MarkdownCompositionRecoveryProps) => {
  const { binding } = props;
  const [discardError, setDiscardError] = useState(false);
  return (
    <Stack gap="xs" bg="bg.muted" px="sm" py="xs">
      <Flex gap="sm" align="center" justify="space-between">
        <Flex gap="xs" align="center">
          <Text color="fg.muted" textStyle="label/S/regular">
            Your draft is kept here.
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
