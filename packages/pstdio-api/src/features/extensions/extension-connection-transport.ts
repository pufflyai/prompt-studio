import type {
  ExtensionConnectionContribution,
  ExtensionConnectionRequest,
  JsonValue,
} from "pstdio-api-contracts/extension-kernel";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_REQUEST_BYTES = 1024 * 1024;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

const pathAllowed = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some(
    (prefix) =>
      prefix.startsWith("/") &&
      !prefix.startsWith("//") &&
      (pathname === prefix || pathname.startsWith(`${prefix.replace(/\/$/, "")}/`)),
  );

const connectionUrl = (baseUrl: string, path: string) => {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Connection request path must be relative to the configured origin.");
  }
  const base = new URL(baseUrl);
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new Error("Connection request cannot change origin.");
  return url;
};

export const responseHeaders = (headers: Headers, secretHeader: string, secret: string) => {
  const result: Record<string, string> = {};
  for (const [key, value] of headers) {
    if (key === "authorization" || key === "set-cookie" || key === secretHeader.toLowerCase()) continue;
    if (value.includes(secret)) throw new Error("Connection response reflected the configured credential.");
    result[key] = value;
  }
  return result;
};

const concatBytes = (chunks: Uint8Array[], size: number) => {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

export const containsBytes = (input: Uint8Array, candidate: Uint8Array) => {
  if (candidate.byteLength === 0 || candidate.byteLength > input.byteLength) return false;
  const inputBuffer = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const candidateBuffer = Buffer.from(candidate.buffer, candidate.byteOffset, candidate.byteLength);
  return inputBuffer.indexOf(candidateBuffer) >= 0;
};

const JSON_ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

const decodeJsonEscapes = (value: string) =>
  value.replace(/\\(?:["\\/bfnrt]|u[\da-fA-F]{4})/g, (sequence) => {
    if (sequence[1] === "u") return String.fromCharCode(Number.parseInt(sequence.slice(2), 16));
    return JSON_ESCAPES[sequence[1]] ?? sequence;
  });

const containsJsonEncodedSecret = (input: Uint8Array, secret: string) =>
  secret.length > 0 && decodeJsonEscapes(new TextDecoder().decode(input)).includes(secret);

export const readBoundedBody = async (body: ReadableStream<Uint8Array> | null) => {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Connection response body is too large.");
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  return concatBytes(chunks, total);
};

export const readSafeStream = async function* (
  body: ReadableStream<Uint8Array> | null,
  secret: string,
  state: { total: number },
): AsyncIterable<Uint8Array> {
  const reader = body?.getReader();
  if (!reader) return;
  const secretBytes = new TextEncoder().encode(secret);
  const protectedBytes = Math.max(secretBytes.byteLength, secret.length * 6);
  let pending = new Uint8Array();
  let completed = false;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      state.total += chunk.value.byteLength;
      if (state.total > MAX_RESPONSE_BYTES) throw new Error("Connection response body is too large.");
      const combined = concatBytes([pending, chunk.value], pending.byteLength + chunk.value.byteLength);
      if (containsBytes(combined, secretBytes) || containsJsonEncodedSecret(combined, secret)) {
        throw new Error("Connection response reflected the configured credential.");
      }
      const safeLength = Math.max(0, combined.byteLength - protectedBytes + 1);
      if (safeLength > 0) yield combined.subarray(0, safeLength);
      pending = combined.slice(safeLength);
    }
    if (pending.byteLength > 0) yield pending;
    completed = true;
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
  }
};

export const parseResponseBody = (bytes: Uint8Array, contentType: string | null): JsonValue => {
  if (bytes.byteLength === 0) return null;
  const text = new TextDecoder().decode(bytes);
  if (contentType?.toLowerCase().includes("application/json")) return JSON.parse(text) as JsonValue;
  return text;
};

export const timeoutSignal = (timeoutMs: number | undefined, signal: AbortSignal | undefined) => {
  const timeout = AbortSignal.timeout(Math.min(Math.max(timeoutMs ?? DEFAULT_TIMEOUT_MS, 1), MAX_TIMEOUT_MS));
  return signal ? AbortSignal.any([timeout, signal]) : timeout;
};

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";

export const validateBaseUrl = (value: string) => {
  const url = new URL(value);
  if (url.username || url.password) throw new Error("Connection URL must not contain credentials.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    throw new Error("Connection URL must use HTTPS outside loopback development.");
  }
  url.hash = "";
  url.search = "";
  return url.toString();
};

export const resolveRequestUrl = (
  contribution: ExtensionConnectionContribution,
  baseUrl: string,
  request: ExtensionConnectionRequest,
) => {
  if (!contribution.allowedMethods.includes(request.method)) {
    throw new Error(`Connection method ${request.method} is not allowed.`);
  }
  const url = connectionUrl(baseUrl, request.path);
  if (!pathAllowed(url.pathname, contribution.allowedPathPrefixes)) {
    throw new Error(`Connection path ${url.pathname} is not allowed.`);
  }
  return url;
};

export const authenticatedHeaders = (
  contribution: ExtensionConnectionContribution,
  request: ExtensionConnectionRequest,
  secret: string,
) => {
  const secretHeader = contribution.auth.type === "bearer" ? "authorization" : contribution.auth.headerName;
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete(secretHeader);
  headers.set(secretHeader, contribution.auth.type === "bearer" ? `Bearer ${secret}` : secret);
  return { headers, secretHeader };
};

export const serializeRequestBody = (request: ExtensionConnectionRequest, headers: Headers) => {
  if (request.body === undefined) return undefined;
  const body = JSON.stringify(request.body);
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
    throw new Error("Connection request body is too large.");
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return body;
};
