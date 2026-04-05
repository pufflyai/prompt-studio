import { listTicketTags } from "./api/list-ticket-tags";

// Resolves option names to option IDs across all tag definitions
export const resolveTagIds = async (projectId: string, tagNames: string[]) => {
  const allTags = await listTicketTags(projectId);
  const allOptions = allTags.flatMap((t) => t.options);
  const ids: string[] = [];

  for (const name of tagNames) {
    const found = allOptions.find((o) => o.name === name);
    if (!found) throw new Error(`Tag option not found: ${name}`);
    ids.push(found.id);
  }

  return ids;
};
