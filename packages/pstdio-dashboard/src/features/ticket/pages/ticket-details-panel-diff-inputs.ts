import type { TicketAttempt } from "@/features/ticket-list/types";
import { isSessionSettled } from "@/features/ticket-list/utils/ticket-attempts";

export const buildTicketDetailsDiffInputs = (workspaces: TicketAttempt[]) =>
  workspaces.map((workspace) => ({
    workspaceId: workspace.id,
    settled: isSessionSettled(workspace.sessionStatus),
  }));
