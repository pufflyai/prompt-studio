type RequestApp = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };
type StreamEvent = { event: string; data: string };

const parseBlock = (block: string): StreamEvent => {
  const lines = block.split("\n");
  const field = (name: string) =>
    lines
      .filter((line) => line.startsWith(`${name}: `))
      .map((line) => line.slice(name.length + 2))
      .join("\n");
  return { event: field("event"), data: field("data") };
};

export const openSessionStreamConnection = async (app: RequestApp) => {
  const response = await app.request("/v1/session-stream");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const next = async () => {
    while (true) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        return parseBlock(block);
      }
      const chunk = await reader.read();
      if (chunk.done) return null;
      buffer += decoder.decode(chunk.value, { stream: true });
    }
  };
  const connected = await next();
  const connectionId = (JSON.parse(connected!.data) as { connection_id: string }).connection_id;
  const subscribe = (subscriptionId: string, sessionId: string) =>
    app.request(`/v1/session-stream/${connectionId}/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription_id: subscriptionId, session_id: sessionId }),
    });
  return { connectionId, next, subscribe, close: () => reader.cancel() };
};

// Replays one subscription in the shape of a single-session SSE response, so tests
// can assert on a session's events without the connection envelope.
export const openSessionStream = async (app: RequestApp, sessionId: string) => {
  const connection = await openSessionStreamConnection(app);
  await connection.subscribe("test-subscription", sessionId);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const event = await connection.next();
      if (!event) {
        controller.close();
        return;
      }
      if (event.event === "heartbeat") return;
      const { data } = JSON.parse(event.data) as { data: unknown };
      controller.enqueue(encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(data)}\n\n`));
      if (event.event === "end" || event.event === "error") {
        controller.close();
        await connection.close();
      }
    },
    cancel: () => connection.close(),
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
};
