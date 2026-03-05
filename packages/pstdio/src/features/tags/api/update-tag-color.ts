export const updateTagColor = async (baseUrl: string, projectId: string, tagId: string, color: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/tags/${encodeURIComponent(tagId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ color }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update tag color: ${res.status}`);
  }
};
