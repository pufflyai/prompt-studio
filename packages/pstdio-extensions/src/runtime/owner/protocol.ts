export type WireValue =
  | null
  | boolean
  | number
  | string
  | { type: "undefined" }
  | { type: "array"; values: WireValue[] }
  | { type: "object"; values: Array<[string, WireValue]> }
  | { type: "bytes"; values: number[] }
  | { type: "local"; value: WireValue }
  | { type: "function" | "promise" | "iterator"; id: string }
  | { type: "stream"; id: string; bytes: boolean }
  | { type: "error-value"; error: RemoteError }
  | { type: "signal"; id: string; aborted: boolean };

export interface RemoteError {
  name: string;
  message: string;
  code?: string;
  retryable?: boolean;
  questionRejected?: boolean;
}

export type OwnerMessage =
  | { type: "call"; id: string; handle: string; args: WireValue }
  | { type: "result"; id: string; value: WireValue }
  | { type: "error"; id: string; error: RemoteError }
  | { type: "abort"; id: string }
  | { type: "release"; ids: string[] };

export const protocolLimits = { pending: 128, handles: 2048, bytes: 2 * 1024 ** 2 };

export const remoteError = (error: unknown): RemoteError => {
  if (!(error instanceof Error)) return { name: "Error", message: String(error) };
  const details = error as Error & Partial<RemoteError>;
  return {
    name: error.name,
    message: error.message,
    ...(typeof details.code === "string" ? { code: details.code } : {}),
    ...(typeof details.retryable === "boolean" ? { retryable: details.retryable } : {}),
    ...(typeof details.questionRejected === "boolean" ? { questionRejected: details.questionRejected } : {}),
  };
};

export const errorFromRemote = (details: RemoteError) => Object.assign(new Error(details.message), details);
