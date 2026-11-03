import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useRef, useState } from "react";
import type { ReviewRequestView } from "../../src/data/review-request-types";
import { RequestsPanel } from "./requests-panel";

interface NeedsAttentionPreviewProps {
  requests: ReviewRequestView[];
  failSave?: boolean;
  answered?: string[];
  onAnswered?: (id: string) => void;
}

// Each real form stays mounted while browsing so its draft is preserved. All writes are local.
export function NeedsAttentionPreview(props: NeedsAttentionPreviewProps) {
  const { requests, failSave, answered, onAnswered } = props;
  const [localAnswered, setLocalAnswered] = useState<string[]>([]);
  const pending = requests.filter(({ id }) => !(answered ?? localAnswered).includes(id));
  const [index, setIndex] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const active = pending[index];
  const answer = async (id: string) => {
    if (failSave) throw new Error("Unable to save. Try again.");
    if (onAnswered) onAnswered(id);
    else setLocalAnswered((current) => [...current, id]);
    setIndex(Math.max(0, Math.min(index, pending.length - 2)));
    requestAnimationFrame(() => panel.current?.focus());
  };
  const openChat = async () => {
    throw new Error("Session navigation is unavailable in this isolated preview.");
  };
  return (
    <Stack ref={panel} tabIndex={-1} gap="sm">
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
          <RequestsPanel row={{ requests: [request], requestErrors: [] }} onAnswer={answer} onOpenChat={openChat} />
        </Stack>
      ))}
      {!active ? (
        <RequestsPanel row={{ requests: [], requestErrors: [] }} onAnswer={answer} onOpenChat={openChat} />
      ) : null}
    </Stack>
  );
}
