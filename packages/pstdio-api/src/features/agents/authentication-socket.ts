import type { WSContext, WSEvents } from "hono/ws";
import {
  type HarnessAuthenticationChannel,
  type HarnessAuthenticationQuestion,
  type HarnessAuthenticationServerMessage,
  harnessAuthenticationClientMessageSchema,
} from "pstdio-api-contracts";
import type { RouteDeps } from "../deps";

export const createHarnessAuthenticationWebSocketEvents = (deps: Pick<RouteDeps, "harnessRegistry">): WSEvents => {
  const controller = new AbortController();
  const secrets = new Set<string>();
  let started = false;
  let waiting:
    | {
        id: string;
        prompt: HarnessAuthenticationQuestion;
        resolve: (value: string) => void;
        reject: (cause: unknown) => void;
      }
    | undefined;
  const cancel = () => {
    controller.abort();
    waiting?.reject(controller.signal.reason);
    waiting = undefined;
  };
  const send = (socket: WSContext, message: HarnessAuthenticationServerMessage) => {
    if (!controller.signal.aborted) socket.send(JSON.stringify(message));
  };
  const run = async (
    socket: WSContext,
    message: Extract<ReturnType<typeof harnessAuthenticationClientMessageSchema.parse>, { type: "open" }>,
  ) => {
    try {
      const harness = await deps.harnessRegistry.get(message.agent, { projectId: message.projectId });
      controller.signal.throwIfAborted();
      if (!harness?.authenticate) throw new Error("Authentication is unavailable for this harness.");
      const channel: HarnessAuthenticationChannel = {
        signal: controller.signal,
        emit: async (prompt) => {
          controller.signal.throwIfAborted();
          send(socket, { type: "prompt", prompt });
        },
        request: async (prompt) => {
          controller.signal.throwIfAborted();
          if (waiting) throw new Error("Only one account question may be pending.");
          const reply = Promise.withResolvers<string>();
          const id = crypto.randomUUID();
          waiting = { id, prompt, ...reply };
          send(socket, { type: "prompt", requestId: id, prompt });
          return reply.promise;
        },
      };
      await harness.authenticate(message.input, channel, { projectId: message.projectId });
      send(socket, { type: "completed" });
    } catch (cause) {
      let message = cause instanceof Error ? cause.message : "Authentication failed.";
      for (const value of secrets) if (value) message = message.replaceAll(value, "[redacted]");
      send(socket, { type: "error", message });
    } finally {
      cancel();
      socket.close(1000);
    }
  };
  const reply = (message: { requestId: string; value: string }) => {
    if (waiting?.id !== message.requestId) return;
    const current = waiting;
    waiting = undefined;
    if (current.prompt.type === "select" && !current.prompt.options.some((option) => option.id === message.value)) {
      current.reject(new Error("Select an available account option."));
      return;
    }
    if (current.prompt.type === "input" && current.prompt.secret) secrets.add(message.value);
    current.resolve(message.value);
  };
  return {
    onMessage(event, socket) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        send(socket, { type: "error", message: "Invalid authentication message." });
        cancel();
        socket.close(1008);
        return;
      }
      const result = harnessAuthenticationClientMessageSchema.safeParse(parsed);
      if (!result.success) {
        send(socket, { type: "error", message: "Invalid authentication message." });
        cancel();
        socket.close(1008);
        return;
      }
      const message = result.data;
      if (message.type === "open") {
        if (started) {
          send(socket, { type: "error", message: "An account flow already owns this connection." });
          cancel();
          socket.close(1008);
          return;
        }
        started = true;
        void run(socket, message);
      } else if (message.type === "cancel") {
        cancel();
        socket.close(1000);
      } else if (waiting?.id === message.requestId) {
        reply(message);
      }
    },
    onClose: cancel,
    onError: cancel,
  };
};
