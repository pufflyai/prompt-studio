export const setDefaultStatus = async (baseUrl: string, projectId: string, statusId: string) => {
  const res = await fetch(
    `${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/statuses/${encodeURIComponent(statusId)}/set-default`,
    { method: "PATCH" },
  );

  if (!res.ok) {
    throw new Error(`Failed to set default status: ${res.status}`);
  }
};
