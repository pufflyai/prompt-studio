import { Box } from "@chakra-ui/react";
import { useState } from "react";
import type { ReviewRequestState, ReviewRequestView } from "../../data/review-request-types";
import { RequestForm } from "./request-form";

export default { title: "Proposals/PS-234 Needs attention timestamps" };

export function Timestamp() {
  const [state, setState] = useState<ReviewRequestState>("open");
  const request: ReviewRequestView = {
    id: "timestamp-preview",
    ticketId: "ticket",
    ticketLabel: "PS-32 · Ship the preview",
    title: "Check the preview",
    instructions: "Open the preview and confirm its layout.",
    request: { kind: "task" },
    requestedAt: "2026-11-14T08:30:00.000Z",
    requestedBy: { type: "agent", id: "agent", displayName: "Agent" },
    context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: null, relatedSessionId: null },
    state,
    outcome: null,
    outcomeText: state === "cancelled" ? "Cancelled: The preview changed." : "Completion confirmed",
  };
  return (
    <Box maxW="sm" p="md">
      <label>
        Request state
        <select value={state} onChange={(event) => setState(event.target.value as ReviewRequestState)}>
          <option value="open">Open</option>
          <option value="answered">Answered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <RequestForm request={request} onAnswer={async () => setState("answered")} onOpenChat={async () => {}} />
    </Box>
  );
}
