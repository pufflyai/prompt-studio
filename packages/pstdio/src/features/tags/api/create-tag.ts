type TagOption = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
};
type Tag = { id: string; name: string; type: string; options: TagOption[] };

type CreateTagInput = {
  name: string;
  type: "single_select" | "multi_select";
  options?: { name: string; color: string }[];
};

export const createTag = async (baseUrl: string, projectId: string, input: CreateTagInput) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/ticket-tags`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Failed to create tag: ${res.status}`);
  }

  return (await res.json()) as Tag;
};
