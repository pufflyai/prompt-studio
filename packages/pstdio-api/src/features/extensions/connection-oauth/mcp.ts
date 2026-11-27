import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ExtensionMcpToolCall, JsonObject } from "pstdio-api-contracts/extension-kernel";
import type { ConnectionKey, ExtensionConnectionServiceDeps } from "../extension-connection-service-types";
import {
  ConnectionInputError,
  containsSecretText,
  MAX_RESPONSE_BYTES,
  serializeRequestBody,
  timeoutSignal,
} from "../extension-connection-transport";
import type { ExtensionOAuthGrants } from "./grants";
import { oauthTarget } from "./provider";

type Credential = Awaited<ReturnType<ExtensionOAuthGrants["access"]>>;

const boundedResponse = (response: Response) => {
  if (!response.body) return response;
  let received = 0;
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_RESPONSE_BYTES) throw new Error("MCP response is too large.");
        controller.enqueue(chunk);
      },
    }),
  );
  return new Response(body, { status: response.status, headers: response.headers });
};

const invoke = async (fetchFn: typeof fetch, endpoint: URL, credential: Credential, input: ExtensionMcpToolCall) => {
  const signal = timeoutSignal(input.timeoutMs, input.signal);
  let unauthorized = false;
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: { authorization: `Bearer ${credential.accessToken}` }, redirect: "error" },
    reconnectionOptions: {
      maxRetries: 0,
      initialReconnectionDelay: 0,
      maxReconnectionDelay: 0,
      reconnectionDelayGrowFactor: 1,
    },
    fetch: async (url, init) => {
      if (new URL(url instanceof Request ? url.url : url).href !== endpoint.href)
        throw new Error("MCP requests cannot change endpoints.");
      const requestSignal = init?.signal ? AbortSignal.any([signal, init.signal]) : signal;
      const response = await fetchFn(url, { ...init, redirect: "error", signal: requestSignal });
      if (response.status === 401 && init?.method === "POST") unauthorized = true;
      return boundedResponse(response);
    },
  });
  const client = new Client({ name: "Prompt Studio", version: "1.0.0" });
  try {
    await client.connect(transport, { signal });
    const result = await client.callTool({ name: input.name, arguments: input.arguments }, undefined, { signal });
    const encoded = JSON.stringify(result);
    if (containsSecretText(encoded, credential.secrets)) throw new Error("MCP tool reflected a credential.");
    return { result: result as JsonObject };
  } catch {
    if (unauthorized) return { unauthorized: true } as const;
    throw new ConnectionInputError("The MCP tool call did not complete.");
  } finally {
    if (transport.sessionId && !signal.aborted) await transport.terminateSession().catch(() => undefined);
    await client.close();
  }
};

export const createMcpToolCaller =
  (deps: ExtensionConnectionServiceDeps, grants: ExtensionOAuthGrants) =>
  async (input: ConnectionKey & { input: ExtensionMcpToolCall; oauthOwner?: () => Promise<string> }) => {
    const call = input.input;
    const contribution = await deps.getContribution(input);
    if (contribution?.transport !== "mcp" || !contribution.allowedTools.includes(call.name))
      throw new ConnectionInputError("This MCP tool is not allowed by the named connection.");
    serializeRequestBody({ method: "POST", path: "/", body: call.arguments }, new Headers());
    const { endpoint, binding } = oauthTarget(contribution);
    const fetchFn = deps.fetch ?? globalThis.fetch;
    call.signal?.throwIfAborted();
    const credential = await grants.access(input, binding, input.oauthOwner);
    const first = await invoke(fetchFn, endpoint, credential, call);
    if (first.result) return first.result;
    const refreshed = await grants.access(input, binding, input.oauthOwner, credential.ref);
    const second = await invoke(fetchFn, endpoint, refreshed, call);
    return second.result ?? refreshed.reject();
  };
