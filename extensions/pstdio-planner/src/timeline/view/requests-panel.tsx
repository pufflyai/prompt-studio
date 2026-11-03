// Put Planner review requests first in the overview, open requests before answered ones.
import { Stack, Text } from "@chakra-ui/react";
import { useRef } from "react";
import type { PlanRow } from "../contracts";
import { RequestCarousel } from "./request-carousel";
import { RequestForm, type RequestHandlers } from "./request-form";

interface RequestsPanelProps extends RequestHandlers {
  row: Pick<PlanRow, "requests" | "requestErrors">;
  heading?: boolean;
  pendingOnly?: boolean;
}

export function RequestsPanel(props: RequestsPanelProps) {
  const { row, onAnswer, onOpenChat, heading = true, pendingOnly = false } = props;
  const panel = useRef<HTMLDivElement>(null);
  const answer: RequestHandlers["onAnswer"] = async (id, response) => {
    await onAnswer(id, response);
    requestAnimationFrame(() => panel.current?.focus());
  };
  const requests = [...row.requests].sort((a, b) => Number(a.state !== "open") - Number(b.state !== "open"));
  return (
    <Stack gap="sm" ref={panel} tabIndex={-1}>
      {heading ? (
        <Text textStyle="label/S/medium" color="fg.muted">
          NEEDS ATTENTION
        </Text>
      ) : null}
      {row.requestErrors.map((error) => (
        <Text key={error} role="alert" color="fg.error">
          {error}
          {
            " Restore the request and its answer from a known-good backup with help from your project maintainer, then reopen this ticket. Work stays paused until the record is readable."
          }
        </Text>
      ))}
      {/* A saved outcome starts a fresh draft; other ticket refreshes preserve edits. */}
      {requests.some(({ state }) => state === "open") ? (
        <RequestCarousel
          requests={requests.filter(({ state }) => state === "open")}
          onAnswer={answer}
          onOpenChat={onOpenChat}
        />
      ) : null}
      {!pendingOnly &&
        requests
          .filter(({ state }) => state !== "open")
          .map((request) => (
            <RequestForm
              key={`${request.id}:${JSON.stringify(request.outcome)}`}
              request={request}
              onAnswer={answer}
              onOpenChat={onOpenChat}
            />
          ))}
      {(!row.requests.length || (pendingOnly && !requests.some(({ state }) => state === "open"))) &&
      !row.requestErrors.length ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          Nothing needs attention.
        </Text>
      ) : null}
    </Stack>
  );
}
