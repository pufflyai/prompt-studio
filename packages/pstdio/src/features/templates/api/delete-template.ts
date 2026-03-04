export const deleteTemplate = async (baseUrl: string, projectId: string, name: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/templates/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });

  if (res.status === 404) {
    throw new Error(`Template not found: ${name}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to delete template: ${res.status}`);
  }
};
