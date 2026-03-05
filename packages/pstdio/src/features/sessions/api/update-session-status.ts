type Session = {
  id: string;
  status: string;
};

export const updateSessionStatus = async (baseUrl: string, sessionId: string, status: string) => {
  const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to update session status: ${res.status}`);

  return (await res.json()) as Session;
};
