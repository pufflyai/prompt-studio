import { expect, test } from "bun:test";
import { createRelayAccess } from "./access";
import { createDocumentRelay } from "./document-http";
import { fetchSyncSpaces } from "./keys";

// The hosted gateway answers 502/503/504 for a moment while an instance or its database recovers.
// One such answer must not fail a sync pass that may already have done minutes of work.
const flaky = (status: number, failures: number, answer: () => Response) => {
  let calls = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => (++calls <= failures ? new Response("gateway", { status }) : answer()),
  });
  return { server, calls: () => calls };
};

const secret = Buffer.alloc(32, 7).toString("base64url");

test("relay writes, sync keys and access renewal survive a brief gateway failure", async () => {
  const signal = new AbortController().signal;
  const relay = flaky(504, 1, () => Response.json({ partSize: 1024, completed: true, parts: [] }));
  const keys = flaky(504, 1, () =>
    Response.json({ project: [{ generation: 1, secret }], personal: [{ generation: 1, secret }] }),
  );
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const manager = flaky(502, 1, () => Response.json({ token: "access", expiresAt }));
  try {
    const document = createDocumentRelay({
      origin: relay.server.url.origin,
      space: { projectId: "project", spaceOwner: null },
      documentId: "document_0123456789abcdef",
      token: async () => "token",
      signal,
    });
    await document.blobs.put("blob_0123456789abcdef", new Uint8Array([1]));
    expect(relay.calls()).toBe(2);

    const spaces = await fetchSyncSpaces({
      managerOrigin: keys.server.url.origin,
      credential: "grant",
      accountId: "account",
      workbenchId: "project",
      signal,
    });
    expect(spaces.project.generation).toBe(1);
    expect(keys.calls()).toBe(2);

    const access = createRelayAccess({
      managerOrigin: manager.server.url.origin,
      renewalGrant: "grant",
      workbenchId: "project",
      signal,
    });
    expect((await access()).token).toBe("access");
    expect(manager.calls()).toBe(2);
  } finally {
    await Promise.all([relay.server.stop(true), keys.server.stop(true), manager.server.stop(true)]);
  }
});
