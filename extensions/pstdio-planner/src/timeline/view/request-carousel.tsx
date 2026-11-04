import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { ReviewRequestView } from "../../data/review-request-types";
import { RequestForm, type RequestHandlers } from "./request-form";

interface RequestCarouselProps extends RequestHandlers {
  requests: ReviewRequestView[];
}

export function RequestCarousel(props: RequestCarouselProps) {
  const { requests, onAnswer, onOpenChat } = props;
  const [answered, setAnswered] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const pending = requests.filter((request) => !answered.includes(request.id));
  const index = Math.max(
    0,
    pending.findIndex(({ id }) => id === selectedId),
  );
  const active = pending[index];
  return (
    <Stack gap="sm">
      {!active ? <Text color="fg.muted">Nothing needs attention.</Text> : null}
      {pending.length > 1 ? (
        <HStack justify="space-between">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setSelectedId(pending[(index + pending.length - 1) % pending.length]!.id)}
          >
            Previous
          </Button>
          <Text textStyle="label/S/regular" aria-live="polite">
            {index + 1} of {pending.length}
          </Text>
          <Button size="xs" variant="ghost" onClick={() => setSelectedId(pending[(index + 1) % pending.length]!.id)}>
            Next
          </Button>
        </HStack>
      ) : null}
      {/* Keep every pending form mounted so navigation and live refreshes preserve drafts. */}
      {pending.map((request) => (
        <Stack
          key={request.id}
          hidden={request.id !== active?.id}
          display={request.id === active?.id ? "flex" : "none"}
        >
          <RequestForm
            request={request}
            onAnswer={async (id, response) => {
              await onAnswer(id, response);
              setSelectedId(pending[(index + 1) % pending.length]?.id);
              setAnswered((current) => [...current, id]);
            }}
            onOpenChat={onOpenChat}
          />
        </Stack>
      ))}
    </Stack>
  );
}
