type Session = {
  id: string;
  project_id: string | null;
  title: string;
  status: string;
  archived: boolean;
  created: string | null;
  last_request_started: string | null;
  last_request_ended: string | null;
  agent: string | null;
  agent_session_id: string | null;
  created_at: string;
  updated_at: string;
};

export const getSession = async (baseUrl: string, sessionId: string) => {
  const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`);

  return (await res.json()) as Session;
};
