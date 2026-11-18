import { expect, test } from "bun:test";
import { channel } from "node:diagnostics_channel";
import { Hono } from "hono";
import { finishRuntimeOperation, runtimeOperationChannel, startRuntimeOperation } from "pstdio-diagnostics";
import { runtimeOperationOrigin } from "./operation-origin";

test("HTTP query origins use the registered route pattern without request data", async () => {
  const events: Record<string, unknown>[] = [];
  const observer = (event: unknown) => events.push(event as Record<string, unknown>);
  const source = channel(runtimeOperationChannel);
  const app = new Hono();
  app.use("*", runtimeOperationOrigin);
  app.get("/sessions/:id", async (context) => {
    await Bun.sleep(1);
    finishRuntimeOperation(startRuntimeOperation("database.query"));
    return context.json({ ok: true });
  });
  source.subscribe(observer);
  try {
    const response = await app.request("/sessions/private-session?secret=private-query");
    expect(response.status).toBe(200);
    expect(events[0]?.origin).toMatchObject({ kind: "request", name: "GET /sessions/:id" });
    expect(JSON.stringify(events)).not.toContain("private-session");
    expect(JSON.stringify(events)).not.toContain("private-query");
  } finally {
    source.unsubscribe(observer);
  }
});
