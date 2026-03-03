type Fetcher = (url: string, init?: RequestInit) => Promise<{ ok: boolean }>;

export const shutdownApi = async (apiUrl: string, fetcher: Fetcher = fetch) => {
  try {
    const response = await fetcher(`${apiUrl}/shutdown`, { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
};
