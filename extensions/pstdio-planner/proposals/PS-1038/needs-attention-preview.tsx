import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { ReviewRequestView } from "../../src/data/review-request-types";
import { RequestsPanel } from "../../src/timeline/view/requests-panel";

interface NeedsAttentionPreviewProps {
  requests: ReviewRequestView[];
  failSave?: boolean;
}

// Each real form stays mounted while browsing so its draft is preserved. All writes are local.
export function NeedsAttentionPreview(props: NeedsAttentionPreviewProps) {
  const { requests, failSave } = props;
  const [pending, setPending] = useState(requests);
  const [index, setIndex] = useState(0);
  const active = pending[index];
  const answer = async (id: string) => {
    if (failSave) throw new Error("Unable to save. Try again.");
    setPending((current) => current.filter((request) => request.id !== id));
    setIndex(Math.max(0, Math.min(index, pending.length - 2)));
  };
  return (
    <Stack gap="sm">
      {pending.length > 1 ? (
        <HStack justify="space-between">
          <Button size="xs" variant="ghost" onClick={() => setIndex((index + pending.length - 1) % pending.length)}>
            Previous
          </Button>
          <Text textStyle="label/S/regular" aria-live="polite">
            {index + 1} of {pending.length}
          </Text>
          <Button size="xs" variant="ghost" onClick={() => setIndex((index + 1) % pending.length)}>
            Next
          </Button>
        </HStack>
      ) : null}
      {pending.map((request) => (
        <Stack key={request.id} display={request.id === active?.id ? "flex" : "none"}>
          <RequestsPanel
            row={{ requests: [request], requestErrors: [] }}
            onAnswer={answer}
            onOpenChat={async () => {}}
          />
        </Stack>
      ))}
      {!active ? (
        <RequestsPanel row={{ requests: [], requestErrors: [] }} onAnswer={answer} onOpenChat={async () => {}} />
      ) : null}
    </Stack>
  );
}
