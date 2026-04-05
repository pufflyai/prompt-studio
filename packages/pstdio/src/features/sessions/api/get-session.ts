import type { Session } from "@pstdio/sdk/resources";

export const getSession = async (baseUrl: string, sessionId: string) => {
  const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`);

  return (await res.json()) as Session;
};
