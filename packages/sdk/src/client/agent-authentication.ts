import {
  type HarnessAuthenticationInput,
  type HarnessAuthenticationPrompt,
  type HarnessAuthenticationQuestion,
  harnessAuthenticationServerMessageSchema,
  RUNTIME_WEBSOCKET_PROTOCOL,
  WEBSOCKET_CREDENTIAL_PROTOCOL_PREFIX,
} from "pstdio-api-contracts";
import { type ClientOptions, createRequestHeaders, resolveBaseUrl } from "./request";

export interface AgentAuthenticationOptions {
  projectId?: string;
  signal?: AbortSignal;
  onPrompt?(prompt: HarnessAuthenticationPrompt): void;
  onRequest?(prompt: HarnessAuthenticationQuestion): Promise<string>;
}

const replyToAuthenticationPrompt = async (
  socket: WebSocket,
  message: Extract<import("pstdio-api-contracts").HarnessAuthenticationServerMessage, { type: "prompt" }>,
  handlers: AgentAuthenticationOptions,
  isDone: () => boolean,
) => {
  handlers.onPrompt?.(message.prompt);
  if (message.prompt.type !== "input" && message.prompt.type !== "select") return;
  if (!message.requestId || !handlers.onRequest) throw new Error("This account flow requires interactive input.");
  const value = await handlers.onRequest(message.prompt);
  if (!isDone()) socket.send(JSON.stringify({ type: "reply", requestId: message.requestId, value }));
};

export const authenticateAgent = (
  options: ClientOptions,
  agent: string,
  input: HarnessAuthenticationInput,
  handlers: AgentAuthenticationOptions = {},
) =>
  new Promise<void>((resolve, reject) => {
    handlers.signal?.throwIfAborted();
    const base = resolveBaseUrl(options);
    const url = new URL(`${base}/v1/agents/authentication`, globalThis.location?.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const token = createRequestHeaders(options)
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    const protocols = token
      ? [RUNTIME_WEBSOCKET_PROTOCOL, `${WEBSOCKET_CREDENTIAL_PROTOCOL_PREFIX}${token}`]
      : [RUNTIME_WEBSOCKET_PROTOCOL];
    const socket = new WebSocket(url, protocols);
    let done = false;
    const finish = (error?: unknown) => {
      if (done) return;
      done = true;
      handlers.signal?.removeEventListener("abort", abort);
      socket.close();
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(handlers.signal?.reason ?? new DOMException("Cancelled", "AbortError"));
    handlers.signal?.addEventListener("abort", abort, { once: true });
    socket.addEventListener("open", () => {
      if (!done) socket.send(JSON.stringify({ type: "open", agent, projectId: handlers.projectId, input }));
    });
    socket.addEventListener("error", () => finish(new Error("Could not connect to the authentication service.")));
    socket.addEventListener("close", () => {
      if (!done) finish(new Error("The authentication connection closed before completion."));
    });
    socket.addEventListener("message", (event) => {
      void (async () => {
        const message = harnessAuthenticationServerMessageSchema.parse(JSON.parse(String(event.data)));
        if (done) return;
        if (message.type === "completed") return finish();
        if (message.type === "error") return finish(new Error(message.message));
        await replyToAuthenticationPrompt(socket, message, handlers, () => done);
      })().catch(finish);
    });
  });
