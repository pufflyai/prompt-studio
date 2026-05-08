import type { GuestHost } from "@pstdio/sdk/extensions";

type CounterCommandId = "lab.counter.bump" | "lab.counter.read" | "lab.counter.reset";

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
  host: GuestHost;
  commandId: CounterCommandId;
  params?: Record<string, unknown>;
}

interface SayHelloCommandInput {
  host: GuestHost;
}

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
  input: { host: GuestHost; params?: Record<string, unknown> },
): Promise<LabCommandResponse> =>
  input.host.call<LabCommandResponse>("commands.execute", { commandId, body: { params: input.params } });

export const executeCounterCommand = async (input: CounterCommandInput) => {
  const { host, commandId, params } = input;
  const response = await executeLabCommand(commandId, { host, params });
  return getCounterFromResponse(response);
};

export const executeSayHelloCommand = async (input: SayHelloCommandInput) => {
  const response = await executeLabCommand("lab.say-hello", input);
  getCommandValueFromResponse(response, "Say hello command failed.");
  return response;
};
