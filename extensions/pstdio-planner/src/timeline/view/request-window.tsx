import { Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { TimelineRequestScope } from "../commands/request-page";
import { RequestsPanel } from "./requests-panel";
import { useLiveValue } from "./use-live-value";
import { type PlanClient, planEvents } from "./use-plan";

const readPage = async (client: PlanClient, input?: string) => {
  const scope = JSON.parse(input!);
  return { input, result: await client.commands["timeline.requests.read"]({ scope }) };
};
export function useRequestWindow(client: PlanClient, scope: TimelineRequestScope) {
  const key = JSON.stringify(scope);
  const [window, setWindow] = useState({ key, offset: 0 });
  const offset = window.key === key ? window.offset : 0;
  const input = JSON.stringify({ ...scope, offset });
  const { value } = useLiveValue(client, readPage, planEvents, input);
  const result = value?.input === input ? value.result : undefined;
  return {
    result,
    previous: value?.result,
    loading: !result,
    offset,
    move: (offset: number) => setWindow({ key, offset }),
  };
}
export function RequestWindowControls(props: {
  result?: { total: number; hasNext: boolean };
  previous?: { total: number; hasNext: boolean };
  loading?: boolean;
  offset: number;
  move: (offset: number) => void;
}) {
  const { offset, move, loading } = props;
  const result = props.result ?? props.previous;
  if (!result || result.total <= 25) return null;
  return (
    <Flex align="center" gap="sm">
      <Button size="xs" variant="outline" disabled={loading || !offset} onClick={() => move(Math.max(0, offset - 25))}>
        Previous
      </Button>
      <Text textStyle="label/S/regular">
        {offset + 1}–{Math.min(offset + 25, result.total)} of {result.total}
      </Text>
      <Button size="xs" variant="outline" disabled={loading || !result.hasNext} onClick={() => move(offset + 25)}>
        Next
      </Button>
    </Flex>
  );
}
export function TicketRequestWindow(props: { client: PlanClient; ticketId: string }) {
  const { client, ticketId } = props;
  const page = useRequestWindow(client, { ticketId });
  return (
    <Stack gap="sm">
      {page.result ? (
        <RequestsPanel
          row={{ requests: page.result.requests, requestErrors: page.result.errors }}
          onAnswer={(requestId, response) => client.commands.review({ requestId, response })}
          onOpenChat={(requestId) => client.commands["review-requests.open"]({ requestId })}
        />
      ) : null}
      <RequestWindowControls {...page} />
    </Stack>
  );
}
