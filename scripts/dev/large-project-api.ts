// HTTP access to an isolated stack for the large-project seeder: product APIs and extension commands only.
export interface StackConnection {
  apiPort: number;
  apiToken: string;
  dashboardUrl: string;
  pstdioHome: string;
}

const BUSY = /Another Planner write is running|Retry when it finishes/;

export const createStackApi = (connection: StackConnection) => {
  const base = `http://127.0.0.1:${connection.apiPort}/v1`;
  const headers = { authorization: `Bearer ${connection.apiToken}`, "content-type": "application/json" };

  const request = async <T>(method: string, path: string, body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };

  // A new project registers its commands shortly after creation, and Planner serializes ticket order.
  const command = async <T>(projectId: string, commandId: string, params: Record<string, unknown> = {}) => {
    const deadline = Date.now() + 5 * 60_000;
    for (;;) {
      const response = await fetch(`${base}/projects/${projectId}/extensions/commands/${commandId}/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({ params }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        outcome?: { status: string; value?: unknown; error?: { message?: string } };
      };
      const message = body.outcome?.error?.message ?? `HTTP ${response.status}`;
      if (response.ok && body.outcome?.status === "success") return body.outcome.value as T;
      if ((response.status === 404 || BUSY.test(message)) && Date.now() < deadline) {
        await Bun.sleep(response.status === 404 ? 2_000 : 100);
        continue;
      }
      throw new Error(`${commandId}: ${message}`);
    }
  };

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
    command,
  };
};

export type StackApi = ReturnType<typeof createStackApi>;

/** Runs `work` for each item with at most `limit` in flight. */
export const inParallel = async <T>(items: T[], limit: number, work: (item: T, index: number) => Promise<void>) => {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await work(items[index]!, index);
      }
    }),
  );
};
