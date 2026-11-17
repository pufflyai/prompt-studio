import { Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { PlannerReadError } from "../../views/planner-read-error";
import type { TimelineRequestScope } from "../commands/request-page";
import { RequestsPanel } from "./requests-panel";
import { type PlanClient, planEvents } from "./use-plan";
import { usePlannerQuery } from "./use-planner-query";

export function useRequestWindow(client: PlanClient, scope: TimelineRequestScope) {
  const key = JSON.stringify(scope);
  const [window, setWindow] = useState({ key, offset: 0 });
  const offset = window.key === key ? window.offset : 0;
  const {
    value: result,
    error,
    retry,
  } = usePlannerQuery(
    client,
    client.commands["timeline.requests.read"].query({ scope: { ...scope, offset } }, { events: planEvents }),
  );
  const [previous, setPrevious] = useState(result);
  if (result && result !== previous) setPrevious(result);
  return {
    result,
    error,
    retry,
    previous,
    loading: !result,
    offset,
    move: (offset: number) => setWindow({ key, offset }),
  };
}
export function RequestWindowControls(props: {
  result?: { total: number; hasNext: boolean };
  previous?: { total: number; hasNext: boolean };
  loading?: boolean;
  error?: Error;
  retry?: () => void;
  offset: number;
  move: (offset: number) => void;
}) {
  const { offset, move, loading } = props;
  const result = props.result ?? props.previous;
  const notice = <PlannerReadError error={props.error} retry={props.retry ?? (() => {})} />;
  if (!result || (result.total <= 25 && !offset)) return notice;
  return (
    <Stack gap="sm">
      {notice}
      <Flex align="center" gap="sm">
        <Button
          size="xs"
          variant="outline"
          disabled={loading || !offset}
          onClick={() => move(Math.max(0, offset - 25))}
        >
          Previous
        </Button>
        <Text textStyle="label/S/regular">
          {offset + 1}–{Math.min(offset + 25, result.total)} of {result.total}
        </Text>
        <Button size="xs" variant="outline" disabled={loading || !result.hasNext} onClick={() => move(offset + 25)}>
          Next
        </Button>
      </Flex>
    </Stack>
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
