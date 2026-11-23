import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

interface TicketDetail {
  tagIds: string[];
}

interface TicketTag {
  id: string;
  name: string;
  options: { id: string; name: string; sortOrder: number }[];
}

export interface FeatureComplexity {
  /** Complexity points per ticket shorthand. 0 means the ticket was read and has no rating. */
  byTicket: Record<string, number>;
  defaultPoints: number;
}

export const DEFAULT_COMPLEXITY: FeatureComplexity = { byTicket: {}, defaultPoints: 2 };

const READERS = 4;
const plannerCommand = (id: string) => ({ kind: "command" as const, extensionId: "pstdio.planner", id });

/**
 * Reads the current Complexity rating of the given tickets only, a few at a time. Planner can hold thousands of
 * tickets, so this never lists the collection (0006.2.15). Ratings of tickets not requested are kept from `saved`.
 */
export const readFeatureComplexity = async (
  { commands }: Pick<ExtensionContextBase, "commands">,
  tickets: string[],
  saved: FeatureComplexity | undefined,
) => {
  const schema = await commands.execute<Record<string, never>, { tags: TicketTag[] }>(
    plannerCommand("ticket-tag.read"),
    { params: {} },
  );
  if (!schema.ok) return;

  const { tags } = schema.value;
  const complexity =
    tags.find(({ id }) => id === "default-complexity") ??
    tags.find(({ name }) => name.trim().toLowerCase() === "complexity");
  const options = [...(complexity?.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const weights = new Map(options.map(({ id }, index) => [id, index + 1]));
  const byTicket = { ...saved?.byTicket };
  const queue = [...new Set(tickets)];
  await Promise.all(
    Array.from({ length: Math.min(READERS, queue.length) }, async () => {
      for (let id = queue.pop(); id; id = queue.pop()) {
        const ticket = await commands.execute<{ id: string }, TicketDetail>(plannerCommand("get-ticket"), {
          params: { id },
        });
        if (!ticket.ok) continue;
        byTicket[id] =
          ticket.value.tagIds.map((tagId) => weights.get(tagId)).find((points) => points !== undefined) ?? 0;
      }
    }),
  );
  return {
    byTicket,
    defaultPoints: options.length ? Math.ceil(options.length / 2) : DEFAULT_COMPLEXITY.defaultPoints,
  } satisfies FeatureComplexity;
};
