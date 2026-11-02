import { expect, test } from "bun:test";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";

const NativeWebSocket = globalThis.WebSocket as {
  new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket;
};

test("an unchanged relay announcement makes a connected peer read without adding edits", async () => {
  const peer = createPackagedSyncPeer(undefined);
  peer.documents.set("~records", { state: null, updates: [] });
  const socket = new NativeWebSocket(`${peer.origin.replace("http:", "ws:")}/sync/project/live`, {
    headers: { authorization: "Bearer relay-access", "pstdio-sync-protocol": "1" },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("message", () => resolve(), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const read = new Promise<unknown>((resolve, reject) => {
      socket.addEventListener(
        "message",
        async (event) => {
          try {
            const message = JSON.parse(String(event.data));
            expect(message).toMatchObject({ type: "changed", documentId: "records", lastSequence: 0 });
            const response = await fetch(`${peer.origin}/sync/projects/project/documents/~records/read`, {
              method: "POST",
              headers: { authorization: "Bearer relay-access", "pstdio-sync-protocol": "1" },
              body: JSON.stringify({ after: 0 }),
            });
            resolve(await response.json());
          } catch (error) {
            reject(error);
          }
        },
        { once: true },
      );
    });
    const before = peer.reads();
    peer.announceUnchanged();
    expect(await read).toMatchObject({ updates: [], lastSequence: 0 });
    expect(peer.reads()).toBe(before + 1);
    expect(peer.states()).toBe(0);
    expect(peer.documents.get("~records")?.updates).toHaveLength(0);
  } finally {
    socket.close();
    await peer.stop();
  }
});
