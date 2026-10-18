import type { CommandContext } from "@pstdio/sdk/extensions";
import type { AttemptRecord } from "../data/attempt-types";
import { readSessionHistory } from "../data/session-history";
import type { StoredTicket } from "../data/types";
import type { PlanRow } from "../timeline/contracts";
import { isLiveSession } from "./auto-build-sessions";
import type { NextTicket, WaitingTicket } from "./next-ticket-types";

export async function nextWorkSnapshot(
  ctx: CommandContext,
  input: {
    revision: string;
    tickets: StoredTicket[];
    attempts: AttemptRecord[];
    rows: PlanRow[];
    next: NextTicket[];
    waiting: WaitingTicket[];
    capacity: { running: number; limit: number };
  },
) {
  const byRef = new Map(
    input.tickets.flatMap((ticket) => [
      [ticket.id, ticket],
      [ticket.shorthand, ticket],
    ]),
  );
  const relevantIds = new Set(input.rows.map(({ id }) => id));
  // Dependencies outside the scope can change whether its work is ready.
  const pendingIds = [...relevantIds];
  for (const id of pendingIds) {
    for (const ref of byRef.get(id)?.dependsOn ?? []) {
      const dependency = byRef.get(ref);
      if (!dependency || relevantIds.has(dependency.id)) continue;
      relevantIds.add(dependency.id);
      pendingIds.push(dependency.id);
    }
  }
  const tickets = input.tickets.filter(({ id }) => relevantIds.has(id)).sort((a, b) => a.id.localeCompare(b.id));
  const attempts = input.attempts
    .filter(({ ticketId }) => relevantIds.has(ticketId))
    .sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
  // Eligibility and capacity changes, including failed workers, are changes the supervisor should see.
  const fingerprint = JSON.stringify({ ...input, tickets, attempts });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const snapshot = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const sessionIds = [...new Set(attempts.map(({ implementationSessionId }) => implementationSessionId))];
  const sessions = await Promise.all(sessionIds.map((id) => ctx.sessions.get(id)));
  const history = (await readSessionHistory(ctx.sessions)).filter(({ id }) => sessionIds.includes(id));
  const progressAt = Math.max(
    0,
    ...tickets.map(({ updatedAt }) => Date.parse(updatedAt)),
    ...attempts.map(({ updatedAt }) => Date.parse(updatedAt)),
    ...input.rows.flatMap(({ requests }) =>
      requests.map((request) => Date.parse(request.outcome?.at ?? request.requestedAt)),
    ),
    ...history.map((session) => Date.parse(session.last_request_started ?? "1970-01-01T00:00:00Z")),
  );
  return { snapshot, progressAt, active: sessions.filter(isLiveSession).length };
}
