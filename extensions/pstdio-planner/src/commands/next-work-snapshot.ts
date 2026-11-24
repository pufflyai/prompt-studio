import type { CommandContext } from "@pstdio/sdk/extensions";
import type { readNextTicketEvidence } from "./next-ticket-evidence";
export const nextWorkDigest = async (value: unknown) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

export const nextDependencySnapshot = async (
  ctx: CommandContext,
  previous: string,
  { closure, requests }: Awaited<ReturnType<typeof readNextTicketEvidence>>,
) => {
  let dependencies = previous;
  dependencies = await nextWorkDigest([
    dependencies,
    closure.tickets.toSorted((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id))),
    [...requests],
  ]);
  for (let start = 0; start < closure.tickets.length; start += 100) {
    const state = await ctx.storage.records.aggregate({
      index: "attempt-ticket",
      where: { field: "ticketId", op: "in", value: closure.tickets.slice(start, start + 100).map(({ id }) => id) },
      fingerprint: ["workspaceId", "implementationSessionId", "revisionHeads"],
    });
    dependencies = await nextWorkDigest([dependencies, state.fingerprint]);
  }

  return dependencies;
};
