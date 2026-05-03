import { createClient } from "@pstdio/sdk/client";

type CounterCommandId = "lab.counter.bump" | "lab.counter.read" | "lab.counter.reset";
type CounterCommandFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface LabCommandResponse {
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

interface SayHelloCommandInput {
  projectId: string;
  fetcher?: CounterCommandFetcher;
}

export const getProjectIdFromSearch = (search: string) => new URLSearchParams(search).get("projectId")?.trim() ?? "";

const getCommandValueFromResponse = (response: LabCommandResponse, fallbackMessage: string) => {
  if (response.outcome.status !== "success") {
    throw new Error(response.outcome.reason ?? fallbackMessage);
  }

  return response.outcome.value;
};

export const getCounterFromResponse = (response: LabCommandResponse) => {
  const value = getCommandValueFromResponse(response, "Counter command failed.");

  if (value && typeof value === "object" && "counter" in value && typeof value.counter === "number") {
    return value.counter;
  }

  throw new Error("Counter command did not return a counter.");
};

const executeLabCommand = async (
  commandId: CounterCommandId | "lab.say-hello",
  input: { projectId: string; params?: Record<string, unknown>; fetcher?: CounterCommandFetcher },
) => {
  const { projectId, params, fetcher = fetch } = input;
  const client = createClient({ baseUrl: "", fetch: fetcher as typeof fetch });

  return client.extensions.execute(commandId, { projectId, params, source: "dashboard" });
};

export const executeCounterCommand = async (input: CounterCommandInput) => {
  const { commandId, projectId, params, fetcher } = input;
  const response = await executeLabCommand(commandId, { projectId, params, fetcher });

  return getCounterFromResponse(response);
};

export const executeSayHelloCommand = async (input: SayHelloCommandInput) => {
  const response = await executeLabCommand("lab.say-hello", input);

  getCommandValueFromResponse(response, "Say hello command failed.");
  return response;
};
