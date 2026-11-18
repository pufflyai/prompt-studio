// HTTP access to an isolated stack for the large-project seeder: product APIs and extension commands only.
export interface StackConnection {
  apiPort: number;
  apiToken: string;
  dashboardUrl: string;
  pstdioHome: string;
}

const BUSY = /Another Planner write is running|Retry when it finishes/;

export const createStackApi = (connection: Pick<StackConnection, "apiPort" | "apiToken">) => {
  const base = `http://127.0.0.1:${connection.apiPort}/v1`;
  const headers = { authorization: `Bearer ${connection.apiToken}`, "content-type": "application/json" };
  // An import of 1,000 tickets can wait behind other projects' imports, so commands get far more time
  // than Bun's default; a runtime that stops answering still ends the call.
  const within = (minutes: number) => ({ signal: AbortSignal.timeout(minutes * 60_000) });
  const raw = async (path: string, init: RequestInit = {}) => {
    const requestHeaders = new Headers(init.headers);
    requestHeaders.set("authorization", headers.authorization);
    const response = await fetch(base + path, {
      ...within(2),
      ...init,
      headers: requestHeaders,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${init.method ?? "GET"} ${path}: HTTP ${response.status} ${text.slice(0, 300)}`);
    }
    return response;
  };

  const request = async <T>(method: string, path: string, body?: unknown) => {
    const response = await raw(path, {
      method,
      headers: { "content-type": headers["content-type"] },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  };

  // A new project registers its commands shortly after creation, and Planner serializes ticket order.
  const command = async <T>(
    projectId: string,
    commandId: string,
    params: Record<string, unknown> = {},
    options: { retryBusy?: boolean } = {},
  ) => {
    const deadline = Date.now() + 5 * 60_000;
    for (;;) {
      const response = await fetch(`${base}/projects/${projectId}/extensions/commands/${commandId}/execute`, {
        ...within(20),
        method: "POST",
        headers,
        body: JSON.stringify({ params }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        outcome?: { status: string; value?: unknown; error?: unknown };
      };
      const error = body.outcome?.error as { message?: string; reason?: string } | undefined;
      const message = error?.message ?? error?.reason ?? (error ? JSON.stringify(error) : `HTTP ${response.status}`);
      if (response.ok && body.outcome?.status === "success") return body.outcome.value as T;
      if ((response.status === 404 || (options.retryBusy !== false && BUSY.test(message))) && Date.now() < deadline) {
        await Bun.sleep(response.status === 404 ? 2_000 : 100);
        continue;
      }
      throw new Error(`${commandId}: ${message}`);
    }
  };

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
    raw,
    command,
  };
};

export type StackApi = ReturnType<typeof createStackApi>;

/** Planner refused a write because another one, such as an earlier import, is still running. */
export const isBusy = (error: unknown) => BUSY.test(String(error));

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
