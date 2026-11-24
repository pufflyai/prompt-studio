import { validatedCommandOutcomeSchema } from "pstdio-api-contracts";
import type { CommandFailureDetails } from "pstdio-api-contracts/extension-kernel";
import type { BackendSurface, SurfaceStep } from "./surface";

/** Raised to every caller waiting on a worker that exited or was retired. Never replayed. */
export class BackendUnavailableError extends Error {
  readonly code = "backend_unavailable";
  constructor(message: string) {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

/** Both sides reject messages of another version instead of guessing their meaning. */
export const BACKEND_PROTOCOL_VERSION = 1;

export interface SerializedBackendError {
  name: string;
  message: string;
  code?: string;
  stack?: string;
}

type Settled = { ok: true; value: unknown } | { ok: false; error: SerializedBackendError };
type InvocationResult = Settled & { rejection?: CommandFailureDetails };

export type HostToWorkerMessage = { v: typeof BACKEND_PROTOCOL_VERSION } & (
  | { type: "load"; entryPath: string }
  | {
      type: "invoke";
      invocationId: string;
      handlerId: string;
      surface: BackendSurface;
      values: Record<string, unknown>;
      args: unknown[];
    }
  | { type: "cancel"; invocationId: string; reason: SerializedBackendError }
  | { type: "discard"; invocationId: string }
  | ({ type: "reply"; invocationId: string; requestId: string } & Settled)
  /** Calls a function the worker passed to the host during this invocation. */
  | {
      type: "fn-call";
      invocationId: string;
      requestId: string;
      fnId: string;
      args: unknown[];
      /** Work started by this callback uses the invocation context and can outlive the callback reply. */
      invocationOwned?: true;
    }
  | { type: "ping"; seq: number }
  | { type: "release"; invocationId: string; fnIds: string[] }
);

export type WorkerToHostMessage = { v: typeof BACKEND_PROTOCOL_VERSION } & (
  | { type: "ready" }
  | ({ type: "loaded" } & Settled)
  | ({ type: "result"; invocationId: string } & InvocationResult)
  | { type: "call"; invocationId: string; requestId: string; path: SurfaceStep[]; args: unknown[]; within?: string }
  | { type: "notify"; invocationId: string; path: SurfaceStep[]; args: unknown[]; within?: string }
  /** Calls a function the host passed to the worker during this invocation. */
  | { type: "fn-call"; invocationId: string; requestId: string; fnId: string; args: unknown[]; within?: string }
  | ({ type: "reply"; invocationId: string; requestId: string } & Settled)
  | { type: "pong"; seq: number; rss: number }
  | { type: "release"; invocationId: string; fnIds: string[] }
);

/** Marks a function in the definition the worker reports. Only the worker can run it. */
export const HANDLER_MARKER = "$pstdioBackendHandler";
export type BackendHandlerRef = { [HANDLER_MARKER]: string };

export const isBackendHandlerRef = (value: unknown): value is BackendHandlerRef =>
  typeof value === "object" && value !== null && typeof (value as Record<string, unknown>)[HANDLER_MARKER] === "string";

const describeErrorValue = (value: unknown) => {
  try {
    return String(value);
  } catch {
    return "The extension backend threw a value that has no text.";
  }
};

// A result the other side cannot parse leaves its caller waiting, so only send valid error fields.
export const serializeBackendError = (error: unknown): SerializedBackendError => {
  try {
    if (!(error instanceof Error)) return { name: "Error", message: describeErrorValue(error) };
    const { name, message, stack, code } = error as Error & { code?: unknown };
    return {
      name: typeof name === "string" ? name : "Error",
      message: typeof message === "string" ? message : describeErrorValue(message),
      ...(typeof stack === "string" ? { stack } : {}),
      ...(typeof code === "string" ? { code } : {}),
    };
  } catch {
    return { name: "Error", message: "The extension backend threw a value that could not be read." };
  }
};

export const deserializeBackendError = (serialized: SerializedBackendError) => {
  const error = new Error(serialized.message) as Error & { code?: string };
  error.name = serialized.name;
  if (serialized.stack) error.stack = serialized.stack;
  if (serialized.code) error.code = serialized.code;
  return error;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Use the public outcome schema for transferable details and discard unrelated fields.
export const transferableCommandRejection = (value: unknown) => {
  if (!isRecord(value)) return;
  try {
    const outcome = validatedCommandOutcomeSchema.safeParse({ ...value, ok: false, status: "rejected" });
    if (!outcome.success || outcome.data.status !== "rejected") return;
    const { ok: _ok, status: _status, ...details } = outcome.data;
    return details;
  } catch {
    // Malformed details must still settle the invocation as an ordinary error.
  }
};

const optionalString = (value: unknown) => value === undefined || typeof value === "string";

const isError = (value: unknown) =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.message === "string" &&
  optionalString(value.code) &&
  optionalString(value.stack);

const isSettled = (message: Record<string, unknown>) =>
  message.ok === true || (message.ok === false && isError(message.error));

const isPath = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (step) => isRecord(step) && typeof step.name === "string" && (step.args === undefined || Array.isArray(step.args)),
  );

type Message = Record<string, unknown>;
const isString = (value: unknown) => typeof value === "string";

const workerMessageChecks: Record<string, (message: Message) => boolean> = {
  ready: () => true,
  loaded: isSettled,
  result: (message) => isString(message.invocationId) && isSettled(message),
  call: (message) =>
    isString(message.invocationId) &&
    isString(message.requestId) &&
    isPath(message.path) &&
    Array.isArray(message.args) &&
    optionalString(message.within),
  "fn-call": (message) =>
    isString(message.invocationId) &&
    isString(message.requestId) &&
    isString(message.fnId) &&
    Array.isArray(message.args) &&
    optionalString(message.within),
  reply: (message) => isString(message.invocationId) && isString(message.requestId) && isSettled(message),
  notify: (message) =>
    isString(message.invocationId) &&
    isPath(message.path) &&
    Array.isArray(message.args) &&
    optionalString(message.within),
  release: (message) => isString(message.invocationId) && Array.isArray(message.fnIds) && message.fnIds.every(isString),
  pong: (message) =>
    Number.isSafeInteger(message.seq) && typeof message.rss === "number" && Number.isFinite(message.rss),
};

/** Validates what the worker sends. The host never trusts its shape or its claimed identity. */
export const parseWorkerMessage = (message: unknown): WorkerToHostMessage | undefined => {
  if (!isRecord(message) || message.v !== BACKEND_PROTOCOL_VERSION || !isString(message.type)) return;
  const check = Object.hasOwn(workerMessageChecks, message.type) ? workerMessageChecks[message.type] : undefined;
  if (!check?.(message)) return;
  if (message.type === "result") {
    return {
      ...message,
      rejection: message.ok === false ? transferableCommandRejection(message.rejection) : undefined,
    } as Extract<WorkerToHostMessage, { type: "result" }>;
  }
  return message as WorkerToHostMessage;
};
