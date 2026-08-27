import type {
  ExtensionConnectionRequest,
  ExtensionConnectionResponse,
  ExtensionConnectionStreamEvent,
  JsonValue,
} from "pstdio-api-contracts/extension-kernel";
import {
  type ConnectionKey,
  type ConnectionRequestAudit,
  connectionKey,
  type ExtensionConnectionServiceDeps,
  toConnectionRecord,
} from "./extension-connection-service-types";
import {
  authenticatedHeaders,
  containsBytes,
  MAX_RESPONSE_BYTES,
  parseResponseBody,
  readBoundedBody,
  readSafeStream,
  resolveRequestUrl,
  responseHeaders,
  serializeRequestBody,
  timeoutSignal,
} from "./extension-connection-transport";

type RequestInput = ConnectionKey & { input: ExtensionConnectionRequest };

export const createExtensionConnectionRequestService = (deps: ExtensionConnectionServiceDeps) => {
  const fetchFn = deps.fetch ?? globalThis.fetch;

  const recordRequest = async (
    input: RequestInput,
    result: Omit<ConnectionRequestAudit, keyof ConnectionKey | "method" | "path">,
  ) => {
    const audit = {
      projectId: input.projectId,
      extensionId: input.extensionId,
      connectionId: input.connectionId,
      method: input.input.method,
      path: input.input.path,
      ...result,
    };
    await Promise.allSettled([
      deps.connectionsDBService.recordCheck(connectionKey(input), {
        ok: result.ok,
        status: result.status,
        error: result.error,
        checkedAt: new Date().toISOString(),
      }),
      Promise.resolve(deps.onRequestComplete?.(audit)),
    ]);
  };

  const prepare = async (input: RequestInput) => {
    const [configured, contribution] = await Promise.all([
      deps.connectionsDBService.get(connectionKey(input)),
      deps.getContribution(input),
    ]);
    if (!contribution) throw new Error(`Connection is not declared: ${input.connectionId}`);
    if (!configured) throw new Error(`Connection is not configured: ${input.connectionId}`);
    const url = resolveRequestUrl(contribution, configured.base_url, input.input);
    const secret = configured.secret_ref ? await deps.secretStore.get(configured.secret_ref) : null;
    if (!secret) throw new Error(`Connection credential is not configured: ${input.connectionId}`);
    const { headers, secretHeader } = authenticatedHeaders(contribution, input.input, secret);
    const body = serializeRequestBody(input.input, headers);

    const response = await fetchFn(url, {
      method: input.input.method,
      headers,
      body,
      redirect: "manual",
      signal: timeoutSignal(input.input.timeoutMs, input.input.signal),
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error("Connection response redirects are not allowed.");
    }

    return { response, secret, secretHeader };
  };

  const request = async <TBody = JsonValue>(input: RequestInput): Promise<ExtensionConnectionResponse<TBody>> => {
    const startedAt = performance.now();
    let status: number | null = null;
    try {
      const { response, secret, secretHeader } = await prepare(input);
      status = response.status;
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        await response.body?.cancel();
        throw new Error("Connection response body is too large.");
      }
      let headers: Record<string, string>;
      try {
        headers = responseHeaders(response.headers, secretHeader, secret);
      } catch (error) {
        await response.body?.cancel();
        throw error;
      }
      const bytes = await readBoundedBody(response.body);
      if (containsBytes(bytes, new TextEncoder().encode(secret))) {
        throw new Error("Connection response reflected the configured credential.");
      }
      const body = parseResponseBody(bytes, response.headers.get("content-type"));
      const exposedBody = typeof body === "string" ? body : JSON.stringify(body);
      if (exposedBody.includes(secret)) {
        throw new Error("Connection response reflected the configured credential.");
      }
      const result = { status: response.status, headers, body: body as TBody };
      const ok = response.status >= 200 && response.status < 300;
      await recordRequest(input, {
        ok,
        status,
        error: ok ? null : `Connection responded with HTTP ${response.status}.`,
        durationMs: performance.now() - startedAt,
        responseBytes: bytes.byteLength,
      });
      return result;
    } catch (error) {
      await recordRequest(input, {
        ok: false,
        status,
        error: error instanceof Error ? error.message : String(error),
        durationMs: performance.now() - startedAt,
        responseBytes: 0,
      });
      throw error;
    }
  };

  const stream = async function* (input: RequestInput): AsyncIterable<ExtensionConnectionStreamEvent> {
    const startedAt = performance.now();
    let status: number | null = null;
    let total = 0;
    let completed = false;
    let responseBody: ReadableStream<Uint8Array> | null = null;
    try {
      const contribution = await deps.getContribution(input);
      if (!contribution?.supportsStreaming) {
        throw new Error(`Connection does not allow streaming: ${input.connectionId}`);
      }
      const { response, secret, secretHeader } = await prepare(input);
      responseBody = response.body;
      status = response.status;
      let headers: Record<string, string>;
      try {
        headers = responseHeaders(response.headers, secretHeader, secret);
      } catch (error) {
        await response.body?.cancel();
        throw error;
      }
      yield { type: "response", status: response.status, headers };

      const state = { total: 0 };
      for await (const data of readSafeStream(response.body, secret, state)) yield { type: "data", data };
      total = state.total;
      completed = true;
      const ok = response.status >= 200 && response.status < 300;
      await recordRequest(input, {
        ok,
        status,
        error: ok ? null : `Connection responded with HTTP ${response.status}.`,
        durationMs: performance.now() - startedAt,
        responseBytes: total,
      });
      yield { type: "end" };
    } finally {
      if (!completed) {
        await responseBody?.cancel().catch(() => undefined);
        await recordRequest(input, {
          ok: false,
          status,
          error: "Connection stream ended before completion.",
          durationMs: performance.now() - startedAt,
          responseBytes: total,
        });
      }
    }
  };

  const check = async (input: ConnectionKey) => {
    const contribution = await deps.getContribution(input);
    if (!contribution?.check) throw new Error(`Connection does not declare a check: ${input.connectionId}`);
    await request({
      ...input,
      input: { method: contribution.check.method, path: contribution.check.path },
    }).catch(() => undefined);
    const stored = await deps.connectionsDBService.get(connectionKey(input));
    if (!stored) throw new Error(`Connection is not configured: ${input.connectionId}`);
    return toConnectionRecord(stored);
  };

  return { check, request, stream };
};
