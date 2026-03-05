export const deleteWorkspace = async (baseUrl: string, id: string) => {
  const res = await fetch(`${baseUrl}/v1/workspaces/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error(`Failed to delete workspace: ${res.status}`);
};
