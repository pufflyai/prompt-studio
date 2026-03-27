export const updateAttemptStatus = async (baseUrl: string, workspaceId: string, status: string) => {
  const res = await fetch(`${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/attempt-status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Failed to update attempt status: ${res.status}`);
  }

  return res.json();
};
