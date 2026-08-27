import type { JsonObject, JsonValue } from "./json";

export type ExtensionConnectionMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ExtensionConnectionRequest {
  method: ExtensionConnectionMethod;
  path: string;
  headers?: Record<string, string>;
  body?: JsonValue;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ExtensionConnectionResponse<TBody = JsonValue> {
  status: number;
  headers: Record<string, string>;
  body: TBody;
}

export type ExtensionConnectionStreamEvent =
  | { type: "response"; status: number; headers: Record<string, string> }
  | { type: "data"; data: Uint8Array }
  | { type: "end" };

export interface ExtensionConnectionsApi {
  request<TBody = JsonValue>(
    connectionId: string,
    input: ExtensionConnectionRequest,
  ): Promise<ExtensionConnectionResponse<TBody>>;
  stream(connectionId: string, input: ExtensionConnectionRequest): AsyncIterable<ExtensionConnectionStreamEvent>;
}

export interface ExtensionLoggerApi {
  info(message: string, metadata?: JsonObject): void;
  warn(message: string, metadata?: JsonObject): void;
  error(message: string, metadata?: JsonObject): void;
}
