export const deleteTag = async (baseUrl: string, projectId: string, tagId: string) => {
  const res = await fetch(
    `${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/ticket-tags/${encodeURIComponent(tagId)}`,
    {
      method: "DELETE",
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to delete tag: ${res.status}`);
  }
};
