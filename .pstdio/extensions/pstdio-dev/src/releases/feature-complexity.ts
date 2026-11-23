import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

interface TicketSummary {
  shorthand: string;
  tags: string[];
}

interface TicketTag {
  id: string;
  name: string;
  options: { name: string; sortOrder: number }[];
}

export interface FeatureComplexity {
  byTicket: Record<string, number>;
  defaultPoints: number;
}

export const DEFAULT_COMPLEXITY: FeatureComplexity = { byTicket: {}, defaultPoints: 2 };

export const readFeatureComplexity = async ({ commands }: Pick<ExtensionContextBase, "commands">) => {
  const plannerCommand = (id: string) => ({ kind: "command" as const, extensionId: "pstdio.pstdio-planner", id });
  const [schema, active, archived] = await Promise.all([
    commands.execute<Record<string, never>, { tags: TicketTag[] }>(plannerCommand("ticket-tag.read"), { params: {} }),
    commands.execute<{ archived: boolean }, TicketSummary[]>(plannerCommand("list-tickets"), {
      params: { archived: false },
    }),
    commands.execute<{ archived: boolean }, TicketSummary[]>(plannerCommand("list-tickets"), {
      params: { archived: true },
    }),
  ]);
  if (!schema.ok || !active.ok || !archived.ok) return;

  const { tags } = schema.value;
  const complexity =
    tags.find(({ id }) => id === "default-complexity") ??
    tags.find(({ name }) => name.trim().toLowerCase() === "complexity");
  const options = [...(complexity?.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const weights = new Map(options.map(({ name }, index) => [name, index + 1]));
  const byTicket: Record<string, number> = {};
  for (const ticket of [...active.value, ...archived.value]) {
    const weight = ticket.tags.map((name) => weights.get(name)).find((points) => points !== undefined);
    if (weight !== undefined) byTicket[ticket.shorthand.toUpperCase()] = weight;
  }
  return {
    byTicket,
    defaultPoints: options.length ? Math.ceil(options.length / 2) : DEFAULT_COMPLEXITY.defaultPoints,
  } satisfies FeatureComplexity;
};
