const COUNTER_COMMAND_ENDPOINT = "/v1/extensions/commands";

type CounterCommandId = "lab.counter.bump" | "lab.counter.read" | "lab.counter.reset";
type CounterCommandFetcher = (url: string, init?: RequestInit) => Promise<Response>;

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
  const response = await fetcher(`${COUNTER_COMMAND_ENDPOINT}/${encodeURIComponent(commandId)}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId, params, source: "dashboard" }),
  });

  if (!response.ok) {
    throw new Error(`Counter command request failed (${response.status}).`);
  }

  return getCounterFromResponse((await response.json()) as CounterCommandResponse);
};
