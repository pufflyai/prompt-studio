import { expect, test } from "bun:test";
import { textEditingFixture } from "../../services/text-editing/text-editing.test-fixture";
import { openSessionStreamConnection } from "../../test-utils/session-stream";
import { createTextStreamTestApp } from "../text-editing/stream.test-utils";
import { streamNativeDocumentEvents } from "./shared-stream";

test("native room subscriptions preserve project scope and cancel without closing a peer", async () => {
  const fixture = await textEditingFixture();
  const app = createTextStreamTestApp(fixture.text, fixture.documents);
  const stream = await openSessionStreamConnection(app);
  const room = await fixture.documents.open({
    projectId: "project-1",
    extensionId: "example.context",
    textDocument: { sourceId: "body", params: {} },
  });
  const subscribe = (id: string, projectId = "project-1") =>
    app.request(`/v1/session-stream/${stream.connectionId}/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subscription_id: id,
        native_document: { project_id: projectId, document_key: room.documentKey, room_id: room.roomId },
      }),
    });
  try {
    expect((await subscribe("a")).status).toBe(204);
    expect((await stream.next())?.event).toBe("document");
    expect((await stream.next())?.event).toBe("presence");
    expect((await subscribe("b")).status).toBe(204);
    expect((await stream.next())?.event).toBe("document");
    expect((await stream.next())?.event).toBe("presence");
    await app.request(`/v1/session-stream/${stream.connectionId}/subscriptions/a`, { method: "DELETE" });
    expect((await subscribe("wrong", "project-2")).status).toBe(204);
    let error = await stream.next();
    while (error?.event === "presence") error = await stream.next();
    expect(error?.event).toBe("error");
    expect(JSON.parse(error!.data)).toMatchObject({ subscription_id: "wrong", data: { message: expect.any(String) } });
    await fixture.documents.close({ projectId: "project-1", roomId: room.roomId });
    let ended = await stream.next();
    while (ended?.event === "presence") ended = await stream.next();
    expect(ended?.event).toBe("end");
    expect(JSON.parse(ended!.data)).toMatchObject({ subscription_id: "b" });
  } finally {
    await stream.close();
    await fixture.cleanup();
  }
});

test.each(["blocked", "rejected"])("a %s terminal write does not retain the native observation", async (mode) => {
  const fixture = await textEditingFixture();
  const writes: string[] = [];
  try {
    await streamNativeDocumentEvents(
      fixture.documents,
      {
        project_id: "project-1",
        document_key: "a".repeat(64),
        room_id: crypto.randomUUID(),
      },
      {
        aborted: false,
        onAbort() {},
        sleep: async () => {},
        write: async (event) => {
          writes.push(event);
          if (mode === "rejected") throw new Error("Socket closed");
          await new Promise<void>(() => {});
        },
      },
    );
    expect(writes).toEqual(["error"]);
  } finally {
    await fixture.cleanup();
  }
});

test("cancelling a blocked document write releases its observer without waiting for the socket", async () => {
  const fixture = await textEditingFixture();
  const room = await fixture.documents.open({
    projectId: "project-1",
    extensionId: "example.context",
    textDocument: { sourceId: "body", params: {} },
  });
  const abort = new AbortController();
  const writing = Promise.withResolvers<void>();
  const observing = streamNativeDocumentEvents(
    fixture.documents,
    {
      project_id: "project-1",
      document_key: room.documentKey,
      room_id: room.roomId,
    },
    {
      get aborted() {
        return abort.signal.aborted;
      },
      onAbort: (listener) => abort.signal.addEventListener("abort", listener, { once: true }),
      sleep: async () => {},
      write: async () => {
        writing.resolve();
        await new Promise<void>(() => {});
      },
    },
  );
  try {
    await writing.promise;
    abort.abort();
    await observing;
    expect(
      (await fixture.documents.snapshot({ projectId: "project-1", roomId: room.roomId })).state.length,
    ).toBeGreaterThan(0);
  } finally {
    abort.abort();
    await fixture.cleanup();
  }
});
