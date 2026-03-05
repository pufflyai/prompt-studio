type FollowUpInput = {
  prompt: string;
  agent?: string;
  model?: string;
};

export const followUpSession = async (baseUrl: string, sessionId: string, input: FollowUpInput) => {
  const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}/follow-up`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json()) as { error: string };
    throw new Error(body.error);
  }

  return (await res.json()) as {
    id: string;
    status: string;
    agent: string | null;
  };
};
