import { createClient } from "@pstdio/sdk/client";

type CounterCommandId = "lab.counter.bump" | "lab.counter.read" | "lab.counter.reset";
type CounterCommandFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface CounterCommandResponse {
  commandId: string;
  extensionId: string;
  outcome: {
    ok: boolean;
    status: "success" | "rejected" | "error";
    reason?: string;
    value?: unknown;
  };
}

interface CounterCommandInput {
  commandId: CounterCommandId;
  projectId: string;
  params?: Record<string, unknown>;
  fetcher?: CounterCommandFetcher;
}

export const getProjectIdFromSearch = (search: string) => new URLSearchParams(search).get("projectId")?.trim() ?? "";

export const getCounterFromResponse = (response: CounterCommandResponse) => {
  if (response.outcome.status !== "success") {
    throw new Error(response.outcome.reason ?? "Counter command failed.");
  }

  const value = response.outcome.value;
  if (value && typeof value === "object" && "counter" in value && typeof value.counter === "number") {
    return value.counter;
  }

  throw new Error("Counter command did not return a counter.");
};

export const executeCounterCommand = async (input: CounterCommandInput) => {
  const { commandId, projectId, params, fetcher = fetch } = input;
  const client = createClient({ baseUrl: "", fetch: fetcher as typeof fetch });
  const response = await client.extensions.execute(commandId, { projectId, params, source: "dashboard" });

  return getCounterFromResponse(response);
};
