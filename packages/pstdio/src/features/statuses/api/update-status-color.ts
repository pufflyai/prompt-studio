export const updateStatusColor = async (baseUrl: string, projectId: string, statusId: string, color: string) => {
  const res = await fetch(
    `${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/statuses/${encodeURIComponent(statusId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to update status color: ${res.status}`);
  }
};
