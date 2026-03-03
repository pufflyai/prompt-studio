export const deleteProject = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}`, {
    method: "DELETE",
  });

  if (res.status === 404) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to delete project: ${res.status}`);
  }
};
