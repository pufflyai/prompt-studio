import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createDocumentRelay } from "pstdio-sync/relay";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";

const peers = new Set<ReturnType<typeof createPackagedSyncPeer>>();
const createPeer = () => {
  const peer = createPackagedSyncPeer(undefined);
  peers.add(peer);
  return peer;
};
const stopPeer = async (peer: ReturnType<typeof createPackagedSyncPeer>) => {
  await peer.stop();
  peers.delete(peer);
};
afterEach(async () => {
  // A timed-out test cannot reach a finally block behind its pending read.
  const results = await Promise.allSettled([...peers].map(stopPeer));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Peer cleanup failed",
    );
});

const enrolledAccess = async (origin: string, deviceId: string, workbenchId: string, code?: string) => {
  // A device signs in through a one-use code; without one it joins the default account.
  const session = code
    ? ((await (
        await fetch(`${origin}/api/auth/one-time-token/verify`, {
          method: "POST",
          body: JSON.stringify({ token: code }),
        })
      ).json()) as { session: { token: string } })
    : undefined;
  const enrolled = await fetch(`${origin}/v1/device-login`, {
    method: "POST",
    headers: session ? { authorization: `Bearer ${session.session.token}` } : {},
    body: JSON.stringify({ deviceId, name: `Device ${deviceId}` }),
  });
  expect(enrolled.ok).toBe(true);
  const device = (await enrolled.json()) as { token: string };
  const issued = await fetch(`${origin}/v1/environment-access`, {
    method: "POST",
    headers: { authorization: `Bearer ${device.token}` },
    body: JSON.stringify({ workbenchId }),
  });
  expect(issued.ok).toBe(true);
  const access = (await issued.json()) as { token: string };
  return { credential: device.token, token: access.token };
};

test("the relay adapter publishes and reads manifest blobs", async () => {
  const peer = createPeer();
  try {
    const projectId = "manifest-project";
    const { token } = await enrolledAccess(peer.origin, "manifest-device", projectId);
    const space = await createSyncSpace({
      projectId,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const relay = createDocumentRelay({
      origin: peer.origin,
      space,
      documentId: "records_0123456789abcdef",
      token: async () => token,
      signal: new AbortController().signal,
    });
    const manifests = await relay.manifestBlobs();
    const child = "c".repeat(64);
    const root = "d".repeat(64);
    const bytes = new Uint8Array([1, 2, 3]);
    await relay.blobs.put(child, bytes);
    await manifests.put(root, bytes, [child]);
    expect(await manifests.get(root, bytes.length)).toEqual(bytes);
  } finally {
    await stopPeer(peer);
  }
});

test("the relay adapter resumes blob reads from the requested byte offset", async () => {
  const peer = createPeer();
  try {
    const projectId = "resumed-blob-read";
    const { token } = await enrolledAccess(peer.origin, "reader", projectId);
    const relay = createDocumentRelay({
      origin: peer.origin,
      space: { projectId, spaceOwner: null },
      documentId: "records_resume_0123456789",
      token: async () => token,
      signal: new AbortController().signal,
    });
    const bytes = new TextEncoder().encode("resume-check");
    const blobId = "resume_blob_0123456789";
    await relay.blobs.put(blobId, bytes);
    const remaining = new Uint8Array(await new Response(await relay.blobs.read!(blobId, 4)).arrayBuffer());
    expect(remaining).toEqual(bytes.subarray(4));
    const complete = new Uint8Array(await new Response(await relay.blobs.read!(blobId, bytes.length)).arrayBuffer());
    expect(complete).toHaveLength(0);
  } finally {
    await stopPeer(peer);
  }
});
