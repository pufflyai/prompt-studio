export const archiveSession = async (baseUrl: string, sessionId: string) => {
  const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}/archive`, {
    method: "POST",
  });

  if (res.status === 404) throw new Error(`Session not found: ${sessionId}`);
  if (res.status === 409) throw new Error(`Session already archived: ${sessionId}`);
  if (!res.ok) throw new Error(`Failed to archive session: ${res.status}`);

  return (await res.json()) as { id: string };
};
