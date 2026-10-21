import { expect } from "bun:test";
import { type RuntimeDescriptor, runtimeAuthorization } from "./packaged-serve-helpers";

export const assertPackagedSessionRetention = async (
  baseUrl: string,
  descriptor: RuntimeDescriptor,
  sessionId: string,
) => {
  const headers = runtimeAuthorization(descriptor);
  const stream = await fetch(`${baseUrl}/v1/session-stream`, { headers });
  expect(stream.status).toBe(200);
  const reader = stream.body!.getReader();
  try {
    const decoder = new TextDecoder();
    let first = "";
    while (!first.includes("\n\n")) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Session stream ended before connecting.");
      first += decoder.decode(chunk.value, { stream: true });
    }
    const data = first.split("\n").find((line) => line.startsWith("data: "));
    const connection = JSON.parse(data!.slice(6)) as { connection_id: string };
    const path = `${baseUrl}/v1/session-stream/${connection.connection_id}/subscriptions`;
    const retained = await fetch(path, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ subscription_id: "open-tab", retain_session_id: sessionId }),
    });
    expect(retained.status).toBe(204);
    expect((await fetch(`${path}/open-tab`, { method: "DELETE", headers })).status).toBe(204);
  } finally {
    await reader.cancel();
  }
};
