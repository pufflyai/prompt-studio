import { expect, test } from "bun:test";
import { createMemoryDocumentStore } from "pstdio-sync";
import type { createPersonalContext } from "./personal-context";
import { createPersonalDocuments } from "./personal-documents";

test("a delayed private team log cannot use the renewed attempt's access", async () => {
  let keyReads = 0;
  let relayReads = 0;
  let authorizations = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname.endsWith("/keys")) {
        const key = { generation: ++keyReads, secret: Buffer.alloc(32, keyReads).toString("base64url") };
        return Response.json({ project: [key], personal: [key] });
      }
      relayReads++;
      return Response.json({ status: "updates", state: null, updates: [], more: false, lastSequence: 0 });
    },
  });
  const runtime = new AbortController();
  const old = new AbortController();
  const next = new AbortController();
  const owner = { workbenchId: "project", extensionId: "personal" };
  const documents = createPersonalDocuments({
    config: {
      accountId: "team",
      userId: "person",
      workbenchId: owner.workbenchId,
      environmentId: "device",
      managerOrigin: server.url.origin,
      relayOrigin: server.url.origin,
      renewalGrant: "fixture",
    },
    context: {
      history: { owner, records: createMemoryDocumentStore() },
      references: { owner, store: createMemoryDocumentStore() },
    } as unknown as ReturnType<typeof createPersonalContext>,
    signal: runtime.signal,
    access: async () => {
      authorizations++;
      return { token: "renewed-team-lease", expiresAt: new Date(Date.now() + 30_000).toISOString() };
    },
    subscribe() {},
  });
  try {
    const first = await documents.prepare(old.signal);
    const delayed = documents.relayFor(first.personal);
    const previews: string[] = [];
    const send = documents.bindLiveSend((message: string) => previews.push(message));
    const delayedPreview = send(first.personal);
    old.abort(new Error("Old team sync attempt ended"));
    const current = await documents.prepare(next.signal);
    delayedPreview("old generation");
    send(current.personal)("current generation");
    expect(previews).toEqual(["current generation"]);
    await expect(delayed(await first.personal.documentId("log")).read(0)).rejects.toThrow(
      "Old team sync attempt ended",
    );
    expect(authorizations).toBe(0);
    expect(relayReads).toBe(0);
    await documents
      .relayFor(current.personal)(await current.personal.documentId("log"))
      .read(0);
    expect(authorizations).toBe(1);
    expect(relayReads).toBe(1);
  } finally {
    runtime.abort();
    next.abort();
    documents.close();
    await server.stop(true);
  }
});
