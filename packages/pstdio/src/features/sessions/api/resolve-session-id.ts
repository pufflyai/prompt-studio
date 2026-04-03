type ResolveSessionIdInput = {
  agent: string;
  agent_session_id: string;
  cwd?: string;
};

type ResolveSessionIdResponse = {
  session_id: string | null;
};

export const resolveSessionId = async (baseUrl: string, input: ResolveSessionIdInput) => {
  const res = await fetch(`${baseUrl}/v1/sessions/resolve-session-id`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((body as { error?: string }).error ?? `Failed to resolve session id: ${res.status}`);
  }

  return (await res.json()) as ResolveSessionIdResponse;
};
