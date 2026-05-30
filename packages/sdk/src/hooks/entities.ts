import type { Ticket, Workspace } from "../resources";

/** @deprecated Legacy core ticket hook entity. Ticket data is owned by the pstdio tickets extension. */
export type HookTicket = Ticket & { status_name: string | null };

export type HookWorkspace = Workspace & {
  /** @deprecated Legacy ticket-workspace linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket_shorthand: string;
  attempt_status_name: string | null;
};
