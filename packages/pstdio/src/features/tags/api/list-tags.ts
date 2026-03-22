type TagOption = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
};
type Tag = { id: string; name: string; type: string; options: TagOption[] };

export const listTags = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/ticket-tags`);

  if (!res.ok) {
    throw new Error(`Failed to list tags: ${res.status}`);
  }

  return (await res.json()) as Tag[];
};
