import { apiRequest } from "@/lib/api";

export const submitApprovalDecision = (input: {
  sessionId: string | null;
  approvalRequestId: string | undefined;
  decision: "approve" | "deny";
}) => {
  if (!input.sessionId || !input.approvalRequestId) return;

  apiRequest(`/v1/sessions/${input.sessionId}/approve`, {
    method: "POST",
    body: { id: input.approvalRequestId, decision: input.decision },
  });
};
