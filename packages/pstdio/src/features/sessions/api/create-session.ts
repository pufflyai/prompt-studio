type CreateSessionInput = {
  project_id: string;
  title: string;
  prompt?: string;
  template?: string;
  vars?: Record<string, string>;
  agent?: string;
  workspace_id?: string;
  model?: string;
  original_session_id?: string;
};

type Session = {
  id: string;
  project_id: string | null;
  title: string;
  status: string;
  agent: string | null;
};

export const createSession = async (baseUrl: string, input: CreateSessionInput) => {
  const res = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((body as { error?: string }).error ?? `Failed to create session: ${res.status}`);
  }

  return (await res.json()) as Session;
};
