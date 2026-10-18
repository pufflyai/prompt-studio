import { type RelayTarget, relayEventSchema, relayPath } from "pstdio-sync-contracts";

export const connectSocket = (origin: URL, scope: RelayTarget, token: string) => {
  const url = new URL(relayPath(scope, "changes"), origin);
  url.protocol = "ws:";
  const socket = new WebSocket(url, { headers: { authorization: `Bearer ${token}` } });
  const messages: { protocolVersion: 1; type: "ready" | "changed" }[] = [];
  const waiting: ReturnType<typeof Promise.withResolvers<(typeof messages)[number]>>[] = [];
  const closed = Promise.withResolvers<CloseEvent>();
  let received = 0;
  let error: Error | undefined;
  socket.addEventListener("message", (event) => {
    const message = relayEventSchema.parse(JSON.parse(String(event.data)));
    messages.push(message);
    waiting.shift()?.resolve(message);
  });
  socket.addEventListener("error", () => {
    error = new Error("WebSocket connection failed");
    for (const pending of waiting.splice(0)) pending.reject(error);
  });
  socket.addEventListener("close", (event) => {
    closed.resolve(event);
    for (const pending of waiting.splice(0)) pending.reject(new Error("WebSocket closed"));
  });
  return {
    socket,
    messages,
    closed: closed.promise,
    next() {
      if (error) return Promise.reject(error);
      const message = messages[received++];
      if (message) return Promise.resolve(message);
      const pending = Promise.withResolvers<(typeof messages)[number]>();
      waiting.push(pending);
      return pending.promise;
    },
  };
};
