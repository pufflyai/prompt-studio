import { listTicketTags } from "./api/list-ticket-tags";

export const resolveTagIds = async (baseUrl: string, projectId: string, tagNames: string[]) => {
  const allTags = await listTicketTags(baseUrl, projectId);
  const ids: string[] = [];

  for (const name of tagNames) {
    const found = allTags.find((t) => t.name === name);
    if (!found) throw new Error(`Tag not found: ${name}`);
    ids.push(found.id);
  }

  return ids;
};
