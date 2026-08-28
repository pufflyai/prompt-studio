import type { GuestHost } from "@pstdio/sdk/extensions";

export type CounterCommandId =
  | "pstdio.extension-lab.command.counter.bump"
  | "pstdio.extension-lab.command.counter.read"
  | "pstdio.extension-lab.command.counter.reset";

const counterCommandIds = new Set<string>([
  "pstdio.extension-lab.command.counter.bump",
  "pstdio.extension-lab.command.counter.read",
  "pstdio.extension-lab.command.counter.reset",
]);

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

interface LabCommandEvent {
  commandId: string;
  tick?: number;
  outcome: {
    ok?: boolean;
    status: string;
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

const getCounterValue = (value: unknown) => {
  if (value && typeof value === "object" && "counter" in value && typeof value.counter === "number") {
    return value.counter;
  }
};

export const getCounterFromResponse = (response: LabCommandResponse) => {
  const value = getCommandValueFromResponse(response, "Counter command failed.");
  const counter = getCounterValue(value);
  if (counter !== undefined) return counter;
  throw new Error("Counter command did not return a counter.");
};

export const getCounterFromCommandEvent = (event: LabCommandEvent | null | undefined) => {
  if (!event || !counterCommandIds.has(event.commandId) || event.outcome.status !== "success") return undefined;
  return getCounterValue(event.outcome.value);
};

const executeLabCommand = async (
  commandId: CounterCommandId | "pstdio.extension-lab.command.say-hello",
  input: { host: GuestHost; params?: Record<string, unknown> },
): Promise<LabCommandResponse> =>
  input.host.call<LabCommandResponse>("commands.execute", { commandId, params: input.params });

export const executeCounterCommand = async (input: CounterCommandInput) => {
  const { host, commandId, params } = input;
  const response = await executeLabCommand(commandId, { host, params });
  return getCounterFromResponse(response);
};

export const executeSayHelloCommand = async (input: SayHelloCommandInput) => {
  const response = await executeLabCommand("pstdio.extension-lab.command.say-hello", input);
  getCommandValueFromResponse(response, "Say hello command failed.");
  return response;
};
