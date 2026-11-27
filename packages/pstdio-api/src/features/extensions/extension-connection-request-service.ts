import type {
  ExtensionConnectionRequest,
  ExtensionConnectionResponse,
  ExtensionConnectionStreamEvent,
  HttpExtensionConnection,
  JsonValue,
} from "pstdio-api-contracts/extension-kernel";
import type { ExtensionOAuthGrants } from "./connection-oauth/grants";
import { oauthTarget } from "./connection-oauth/provider";
import {
  type ConnectionKey,
  type ConnectionRequestAudit,
  connectionKey,
  type ExtensionConnectionServiceDeps,
  type StoredConnection,
  toConnectionRecord,
} from "./extension-connection-service-types";
import {
  authenticatedHeaders,
  readProtectedResponse,
  readSafeStream,
  resolveRequestUrl,
  responseHeaders,
  serializeRequestBody,
  timeoutSignal,
} from "./extension-connection-transport";

type RequestInput = ConnectionKey & { input: ExtensionConnectionRequest; oauthOwner?: () => Promise<string> };
type RequestTarget = { key: ReturnType<typeof connectionKey>; configured: StoredConnection };

export const createExtensionConnectionRequestService = (
  deps: ExtensionConnectionServiceDeps,
  oauth: ExtensionOAuthGrants,
) => {
  const fetchFn = deps.fetch ?? globalThis.fetch;

  const recordRequest = async (
    input: RequestInput,
    result: Omit<ConnectionRequestAudit, keyof ConnectionKey | "method" | "path">,
    target?: RequestTarget,
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
      Promise.resolve().then(
        () =>
          target &&
          deps.connectionsDBService.recordCheck(
            target.key,
            { ok: result.ok, status: result.status, error: result.error, checkedAt: new Date().toISOString() },
            target.configured,
          ),
      ),
      Promise.resolve().then(() => deps.onRequestComplete?.(audit)),
    ]);
  };

  const contributionFor = async (input: RequestInput) => {
    const contribution = await deps.getContribution(input);
    if (contribution?.transport !== "http")
      throw new Error(`Connection is not declared for HTTP: ${input.connectionId}`);
    return contribution;
  };

  const resolveTarget = async (input: RequestInput, contribution: HttpExtensionConnection) => {
    const key = connectionKey(input, contribution.scope);
    const configured = await deps.connectionsDBService.get(key);
    if (!configured) throw new Error(`Connection is not configured: ${input.connectionId}`);
    return { key, configured };
  };

  const prepare = async (input: RequestInput, contribution: HttpExtensionConnection, configured?: StoredConnection) => {
    const oauthResource = contribution.auth.type === "oauth" ? oauthTarget(contribution) : undefined;
    const baseUrl = oauthResource?.endpoint.href ?? configured?.base_url;
    if (!baseUrl) throw new Error(`Connection is not configured: ${input.connectionId}`);
    const url = resolveRequestUrl(contribution, baseUrl, input.input);
    const signal = timeoutSignal(input.input.timeoutMs, input.input.signal);
    const send = async (secret: string, secrets: string[]) => {
      const { headers, secretHeader } = authenticatedHeaders(contribution, input.input, secret);
      const body = serializeRequestBody(input.input, headers);
      const response = await fetchFn(url, {
        method: input.input.method,
        headers,
        body,
        redirect: "manual",
        signal,
      }).catch((error) => {
        if (oauthResource) throw new Error("The OAuth resource could not be reached.");
        throw error;
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new Error("Connection response redirects are not allowed.");
      }
      return { response, secrets, secretHeader };
    };
    if (!oauthResource) {
      const secret = configured?.secret_ref ? await deps.secretStore.get(configured.secret_ref) : null;
      if (!secret) throw new Error(`Connection credential is not configured: ${input.connectionId}`);
      return send(secret, [secret]);
    }
    signal.throwIfAborted();
    const credential = await oauth.access(input, oauthResource.binding, input.oauthOwner);
    signal.throwIfAborted();
    const first = await send(credential.accessToken, credential.secrets);
    if (first.response.status !== 401) return first;
    await first.response.body?.cancel();
    const refreshed = await oauth.access(input, oauthResource.binding, input.oauthOwner, credential.ref);
    signal.throwIfAborted();
    const second = await send(refreshed.accessToken, refreshed.secrets);
    if (second.response.status !== 401) return second;
    await second.response.body?.cancel();
    return refreshed.reject();
  };

  const request = async <TBody = JsonValue>(input: RequestInput): Promise<ExtensionConnectionResponse<TBody>> => {
    const startedAt = performance.now();
    let status: number | null = null;
    let target: RequestTarget | undefined;
    try {
      const contribution = await contributionFor(input);
      if (contribution.auth.type !== "oauth") target = await resolveTarget(input, contribution);
      const { response, secrets, secretHeader } = await prepare(input, contribution, target?.configured);
      status = response.status;
      const { headers, body, responseBytes } = await readProtectedResponse(response, secretHeader, secrets);
      const result = { status: response.status, headers, body: body as TBody };
      const ok = response.status >= 200 && response.status < 300;
      await recordRequest(
        input,
        {
          ok,
          status,
          error: ok ? null : `Connection responded with HTTP ${response.status}.`,
          durationMs: performance.now() - startedAt,
          responseBytes,
        },
        target,
      );
      return result;
    } catch (error) {
      await recordRequest(
        input,
        {
          ok: false,
          status,
          error: error instanceof Error ? error.message : String(error),
          durationMs: performance.now() - startedAt,
          responseBytes: 0,
        },
        target,
      );
      throw error;
    }
  };

  const stream = async function* (input: RequestInput): AsyncIterable<ExtensionConnectionStreamEvent> {
    const startedAt = performance.now();
    let status: number | null = null;
    let total = 0;
    let completed = false;
    let responseBody: ReadableStream<Uint8Array> | null = null;
    let target: RequestTarget | undefined;
    try {
      const contribution = await contributionFor(input);
      if (contribution.auth.type !== "oauth") target = await resolveTarget(input, contribution);
      if (!contribution?.supportsStreaming) {
        throw new Error(`Connection does not allow streaming: ${input.connectionId}`);
      }
      const { response, secrets, secretHeader } = await prepare(input, contribution, target?.configured);
      responseBody = response.body;
      status = response.status;
      let headers: Record<string, string>;
      try {
        headers = responseHeaders(response.headers, secretHeader, secrets);
      } catch (error) {
        await response.body?.cancel();
        throw error;
      }
      yield { type: "response", status: response.status, headers };

      const state = { total: 0 };
      for await (const data of readSafeStream(response.body, secrets, state)) yield { type: "data", data };
      total = state.total;
      completed = true;
      const ok = response.status >= 200 && response.status < 300;
      await recordRequest(
        input,
        {
          ok,
          status,
          error: ok ? null : `Connection responded with HTTP ${response.status}.`,
          durationMs: performance.now() - startedAt,
          responseBytes: total,
        },
        target,
      );
      yield { type: "end" };
    } finally {
      if (!completed) {
        await responseBody?.cancel().catch(() => undefined);
        await recordRequest(
          input,
          {
            ok: false,
            status,
            error: "Connection stream ended before completion.",
            durationMs: performance.now() - startedAt,
            responseBytes: total,
          },
          target,
        );
      }
    }
  };

  const check = async (input: ConnectionKey) => {
    const contribution = await deps.getContribution(input);
    if (contribution?.transport !== "http" || contribution.auth.type === "oauth" || !contribution.check)
      throw new Error(`Connection does not declare a check: ${input.connectionId}`);
    await request({
      ...input,
      input: {
        method: contribution.check.method,
        path: contribution.check.path,
        headers: contribution.check.headers,
      },
    }).catch(() => undefined);
    const stored = await deps.connectionsDBService.get(connectionKey(input, contribution.scope));
    if (!stored) throw new Error(`Connection is not configured: ${input.connectionId}`);
    return toConnectionRecord(stored);
  };

  return { check, request, stream };
};
