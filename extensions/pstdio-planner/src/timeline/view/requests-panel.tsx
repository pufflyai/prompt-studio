// Put Planner review requests first in the overview, open requests before answered ones.
import { Stack, Text } from "@chakra-ui/react";
import type { PlanRow } from "../contracts";
import { RequestForm, type RequestHandlers } from "./request-form";

interface RequestsPanelProps extends RequestHandlers {
  row: Pick<PlanRow, "requests" | "requestErrors">;
}

export function RequestsPanel(props: RequestsPanelProps) {
  const { row, onAnswer, onOpenChat } = props;
  const requests = [...row.requests].sort((a, b) => Number(a.state !== "open") - Number(b.state !== "open"));
  return (
    <Stack gap="sm">
      <Text textStyle="label/S/medium" color="fg.muted">
        NEEDS ATTENTION
      </Text>
      {row.requestErrors.map((error) => (
        <Text key={error} role="alert" color="fg.error">
          {error}
          {
            " Restore the request and its answer from a known-good backup with help from your project maintainer, then reopen this ticket. Work stays paused until the record is readable."
          }
        </Text>
      ))}
      {/* A saved outcome starts a fresh draft; other ticket refreshes preserve edits. */}
      {requests.map((request) => (
        <RequestForm
          key={`${request.id}:${JSON.stringify(request.outcome)}`}
          request={request}
          onAnswer={onAnswer}
          onOpenChat={onOpenChat}
        />
      ))}
      {!row.requests.length && !row.requestErrors.length ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          Nothing needs attention.
        </Text>
      ) : null}
    </Stack>
  );
}
