export const stressTicketCount = 1000;
export const focusCount = 25;
export const focusViewTitle = "Focus 25 of 1,000";
export const trackNames = ["Stress Client", "Stress API", "Stress Storage", "Stress Integrations", "Stress Release"];
const focusTitle = "Planner stress focus";

export const focusFilter = {
  conjunction: "and" as const,
  rules: [{ attributeId: "title", condition: "contains", value: focusTitle }],
};

export const stressTitle = (index: number) => {
  const group = index < focusCount ? focusTitle : "Planner stress background";
  const detail = index % 7 === 0 ? " with a longer title that wraps across several lines of the shared card" : "";
  return `${group} ${String(index + 1).padStart(4, "0")}${detail}`;
};

export function stressTicketInput(index: number, tickets: readonly { id: string }[], tracks: readonly string[]) {
  return {
    content: `# ${stressTitle(index)}\n\n${"Exercise plan reads with a realistic document that opens on demand. ".repeat(24)}`,
    status: "Todo",
    tagIds: [tracks[index % trackNames.length]!],
    dependsOn: index < trackNames.length ? [] : [tickets[index - trackNames.length]!.id],
  };
}

// Resume only this fixture's serial prefix; never overwrite unrelated project work.
export function stressTicketsInOrder<T extends { id: string; title: string }>(tickets: T[]) {
  const byTitle = new Map(tickets.map((ticket) => [ticket.title, ticket]));
  const ordered = Array.from({ length: tickets.length }, (_, index) => byTitle.get(stressTitle(index)));
  if (tickets.length > stressTicketCount || byTitle.size !== tickets.length || ordered.some((ticket) => !ticket)) {
    throw new Error("This project is not an unchanged stress fixture. Use a fresh --name, or --down to reset it.");
  }
  return ordered as T[];
}
