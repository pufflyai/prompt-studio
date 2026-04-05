import type { Ticket, Workspace } from "../resources";

export type HookTicket = Ticket & { status_name: string | null };

export type HookWorkspace = Workspace & {
  ticket_shorthand: string;
  attempt_status_name: string | null;
};
