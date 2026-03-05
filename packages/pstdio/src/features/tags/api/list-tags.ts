type Tag = { id: string; name: string; color: string };

export const listTags = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/tags`);

  if (!res.ok) {
    throw new Error(`Failed to list tags: ${res.status}`);
  }

  return (await res.json()) as Tag[];
};
