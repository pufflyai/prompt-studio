// Put Planner review requests first in the overview, open requests before answered ones.
import { Box, Stack, Text } from "@chakra-ui/react";
import type { PlanRow } from "../contracts";
import { Instructions } from "./instructions";
import { RequestForm, type RequestHandlers } from "./request-form";

interface RequestsPanelProps extends RequestHandlers {
  row: PlanRow;
}

export function RequestsPanel(props: RequestsPanelProps) {
  const { row, onAnswer, onOpenChat } = props;
  const human = row.state === "await-input";
  const requests = [...row.requests].sort((a, b) => Number(a.state !== "open") - Number(b.state !== "open"));
  return (
    <Stack gap="sm">
      <Text textStyle="label/S/medium" color="fg.muted">
        REQUESTS
      </Text>
      {row.requestErrors.map((error) => (
        <Text key={error} role="alert" color="fg.error">
          {error}
        </Text>
      ))}
      {requests.map((request) => (
        <RequestForm key={request.id} request={request} onAnswer={onAnswer} onOpenChat={onOpenChat} />
      ))}
      {human && !row.requests.some((request) => request.state === "open") && !row.requestErrors.length ? (
        <Box p="sm" bg="bg.subtle" borderRadius="md">
          <Instructions text={row.instructions || "Open the ticket to see what a person needs to do."} />
        </Box>
      ) : null}
      {!human && !row.requests.length && !row.requestErrors.length ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          No human input requested.
        </Text>
      ) : null}
    </Stack>
  );
}
