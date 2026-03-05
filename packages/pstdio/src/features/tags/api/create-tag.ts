type Tag = { id: string; name: string; color: string };

export const createTag = async (baseUrl: string, projectId: string, input: { name: string; color: string }) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/tags`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Failed to create tag: ${res.status}`);
  }

  return (await res.json()) as Tag;
};
