export const deleteStatus = async (baseUrl: string, projectId: string, statusId: string) => {
  const res = await fetch(
    `${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/statuses/${encodeURIComponent(statusId)}`,
    { method: "DELETE" },
  );

  if (!res.ok) {
    throw new Error(`Failed to delete status: ${res.status}`);
  }
};
