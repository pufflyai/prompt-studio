export const getStartupLog = async (baseUrl: string, workspaceId: string) => {
  const res = await fetch(`${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/startup-log`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get startup log: ${res.status}`);

  return await res.text();
};
