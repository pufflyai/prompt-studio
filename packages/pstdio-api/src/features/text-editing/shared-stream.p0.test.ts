import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import { selected, textEditingFixture } from "../../services/text-editing/text-editing.test-fixture";
import { openSessionStreamConnection } from "../../test-utils/session-stream";
import { createTextStreamTestApp } from "./stream.test-utils";

test("shared text subscriptions route each event to its scoped connection and reject another project", async () => {
  const fixture = await textEditingFixture();
  const app = createTextStreamTestApp(fixture.text);
  const stream = await openSessionStreamConnection(app);
  const a = {
    projectId: "project-1",
    ...(await fixture.text.connect("project-1", { kind: "agent", target: selected })),
  };
  const b = {
    projectId: "project-1",
    ...(await fixture.text.connect("project-1", { kind: "agent", target: selected })),
  };
  const subscribe = (id: string, projectId: string, token: string) =>
    app.request(`/v1/session-stream/${stream.connectionId}/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription_id: id, text_editing: { project_id: projectId, token } }),
    });
  try {
    expect((await subscribe("a", a.projectId, a.token)).status).toBe(204);
    expect((await stream.next())?.event).toBe("text_ready");
    expect((await subscribe("b", b.projectId, b.token)).status).toBe(204);
    expect((await stream.next())?.event).toBe("text_ready");
    await fixture.text.prepareClose(a);
    const event = await stream.next();
    expect(event?.event).toBe("text");
    expect(JSON.parse(event!.data)).toMatchObject({ subscription_id: "a", data: { type: "prepareClose" } });
    await app.request(`/v1/session-stream/${stream.connectionId}/subscriptions/a`, { method: "DELETE" });
    await fixture.text.prepareClose(b);
    expect(JSON.parse((await stream.next())!.data)).toMatchObject({
      subscription_id: "b",
      data: { type: "prepareClose" },
    });
    expect((await subscribe("wrong-project", "project-2", b.token)).status).toBe(204);
    const error = await stream.next();
    expect(error?.event).toBe("text_error");
    expect(JSON.parse(error!.data)).toMatchObject({
      subscription_id: "wrong-project",
      data: { code: "grant_invalid" },
    });
  } finally {
    await stream.close();
    await fixture.text.disconnect(a);
    await fixture.text.disconnect(b);
    await fixture.cleanup();
  }
});

test("the SDK text watch receives buffered events through the real shared subscription route", async () => {
  const fixture = await textEditingFixture();
  const app = createTextStreamTestApp(fixture.text);
  const client = createClient({
    baseUrl: "http://localhost",
    fetch: ((url, options) => app.request(new Request(url, options))) as typeof fetch,
  });
  const connection = await client.textEditing.connect({
    projectId: "project-1",
    scope: { kind: "agent", target: selected },
  });
  const abort = new AbortController();
  const received = Promise.withResolvers<unknown>();
  let watch: Promise<void> | undefined;
  try {
    await connection.prepareClose();
    watch = connection.watch({ signal: abort.signal, onEvent: received.resolve });
    void watch.catch(received.reject);
    expect(await received.promise).toMatchObject({ type: "prepareClose", barrierId: expect.any(String) });
  } finally {
    abort.abort();
    await watch;
    await connection.disconnect();
    await fixture.cleanup();
  }
});

test("reconnecting a text watcher replays its still-active close barrier", async () => {
  const fixture = await textEditingFixture();
  const address = {
    projectId: "project-1",
    ...(await fixture.text.connect("project-1", { kind: "agent", target: selected })),
  };
  const memberId = crypto.randomUUID();
  await fixture.text.request(address, { operation: "register", memberId });
  const events: import("pstdio-api-contracts/extension-kernel").TextEditingEvent[] = [];
  const firstStop = fixture.text.listen(address, (event) => events.push(event));
  const closing = fixture.text.prepareClose(address);
  const barrier = events.find((event) => event.type === "prepareClose")!;
  firstStop();
  const replayed: typeof events = [];
  const stop = fixture.text.listen(address, (event) => replayed.push(event));
  try {
    expect(replayed).toContainEqual(barrier);
  } finally {
    stop();
    if (barrier.type === "prepareClose")
      await fixture.text.request(address, {
        operation: "closeReady",
        memberId,
        barrierId: barrier.barrierId,
      });
    await closing;
    await fixture.text.disconnect(address);
    await fixture.cleanup();
  }
});
