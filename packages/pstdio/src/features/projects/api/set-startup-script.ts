export const setStartupScript = async (baseUrl: string, projectId: string, script: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${projectId}/startup-script`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startup_script: script }),
  });

  if (res.status === 404) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (!res.ok) {
    throw new Error(`Failed to set startup script: ${res.status}`);
  }
};
