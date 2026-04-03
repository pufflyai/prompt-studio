export const updateAttemptStatus = async (baseUrl: string, workspaceId: string, status: string, sessionId?: string) => {
  const body = {
    status,
    ...(sessionId ? { session_id: sessionId } : {}),
  };

  const res = await fetch(`${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/attempt-status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = (await res.json()) as { error?: string; hook_output?: string };
    const hookOutput = body.hook_output?.trim();
    const errorMessage = body.error ?? `Failed to update attempt status: ${res.status}`;
    throw new Error(hookOutput ? `${errorMessage}\n${hookOutput}` : errorMessage);
  }

  return res.json();
};
