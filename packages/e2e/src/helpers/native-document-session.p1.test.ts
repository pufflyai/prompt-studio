import { afterEach, expect, test } from "bun:test";
import { createNativeDocumentSession } from "@pstdio/workbench";
import * as Y from "yjs";
import { createNativeDocumentSessionFixture } from "./native-document-session.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const host = await createNativeDocumentSessionFixture();
  cleanup.push(host.close);
  const session = createNativeDocumentSession(host);
  cleanup.push(() => {
    host.setOffline(false);
    return session.close();
  });
  await session.start();
  return { ...host, session };
};
const waitFor = (session: ReturnType<typeof createNativeDocumentSession>, source: string) =>
  new Promise<void>((resolve) => {
    const check = () => {
      if (session.getSnapshot().document?.getText("content").toString() !== source) return;
      stop();
      resolve();
    };
    const stop = session.subscribe(check);
    check();
  });

test("browser sessions share transient selections and clear participants when the host disconnects", async () => {
  const f = await fixture();
  const peer = createNativeDocumentSession(f);
  cleanup.push(() => peer.close());
  await peer.start();
  expect(f.session.getSnapshot().participants).toBeArray();
  const when = (session: typeof peer, check: () => boolean) =>
    new Promise<void>((resolve) => {
      const changed = () => {
        if (check()) {
          stop();
          resolve();
        }
      };
      const stop = session.subscribe(changed);
      changed();
    });
  await when(f.session, () => f.session.getSnapshot().participants.length === 1);
  const text = f.session.getSnapshot().document!.getText("content");
  const position = Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, 2));
  await f.session.setSelection({ anchor: position, focus: position });
  const hasSelection = () => Boolean(peer.getSnapshot().participants[0]?.selection);
  await when(peer, hasSelection);
  const anchor = peer.getSnapshot().participants[0]!.selection!.anchor;
  const relative = Y.decodeRelativePosition(Uint8Array.from(atob(anchor), (character) => character.charCodeAt(0)));
  expect(Y.createAbsolutePositionFromRelativePosition(relative, peer.getSnapshot().document!)?.index).toBe(2);
  expect(f.session.getSnapshot().pending).toBe(false);
  f.setOffline(true);
  await when(peer, () => !peer.getSnapshot().connected && peer.getSnapshot().participants.length === 0);
  expect(f.session.getSnapshot().participants).toEqual([]);
  f.setOffline(false);
  await Promise.all([f.session.retry(), peer.retry()]);
  await when(peer, hasSelection);
}, 5_000);

test("two browser sessions receive concurrent local edits through the host stream", async () => {
  const f = await fixture();
  const peer = createNativeDocumentSession(f);
  cleanup.push(() => peer.close());
  await peer.start();
  const first = f.session.getSnapshot().document!.getText("content");
  const second = peer.getSnapshot().document!.getText("content");
  first.insert(0, "LEFT ");
  second.insert(second.length, " RIGHT");
  await Promise.all([f.session.flush(), peer.flush()]);
  await Promise.all([waitFor(f.session, "LEFT first\nlast RIGHT"), waitFor(peer, "LEFT first\nlast RIGHT")]);
  expect(f.session.getSnapshot().pending).toBe(false);
  expect(peer.getSnapshot().pending).toBe(false);
}, 5_000);

test("an edit arriving while its preceding acknowledgement waits is saved in the next batch", async () => {
  const f = await fixture();
  const gate = f.pauseNextAcknowledgement();
  const text = f.session.getSnapshot().document!.getText("content");
  text.insert(0, "FIRST ");
  const saving = f.session.flush();
  await gate.entered.promise;
  text.insert(text.length, " LAST");
  gate.release.resolve();
  await saving;
  expect(f.session.getSnapshot().pending).toBe(false);
  const read = createNativeDocumentSession({ ...f, client: f.client });
  await read.start();
  expect(read.getSnapshot().document!.getText("content").toString()).toBe("FIRST first\nlast LAST");
  await read.close();
}, 5_000);

test("a late local frame survives a reconnect acknowledgement that adopts another root", async () => {
  const f = await fixture();
  const other = await createNativeDocumentSessionFixture();
  cleanup.push(other.close);
  const remote = await other.client.open({ projectId: other.projectId, target: other.target });
  f.setOffline(true);
  const original = f.session.getSnapshot().document!;
  original.getText("content").insert(0, "OFFLINE ");
  await expect(f.session.flush()).rejects.toThrow();
  await f.adopt(remote.state);
  f.setOffline(false);
  const gate = f.pauseNextHandshake();
  const reconnecting = f.session.retry();
  await gate.entered.promise;
  original.getText("content").insert(original.getText("content").length, " LATE");
  gate.release.resolve();
  await reconnecting;
  expect(f.session.getSnapshot().pending).toBe(false);
  expect(f.session.getSnapshot().document).not.toBe(original);
  expect(f.session.getSnapshot().document!.getText("content").toString()).toBe("OFFLINE first\nlast LATE");
}, 5_000);

test("a failed local-host request keeps unsaved frames and reconnect merges their original history", async () => {
  const f = await fixture();
  f.setOffline(true);
  const text = f.session.getSnapshot().document!.getText("content");
  text.insert(0, "OFFLINE ");
  await expect(f.session.flush()).rejects.toThrow();
  expect(f.session.getSnapshot().pending).toBe(true);
  expect(text.toString()).toBe("OFFLINE first\nlast");
  f.setOffline(false);
  await f.session.retry();
  expect(f.session.getSnapshot().pending).toBe(false);
  expect(f.session.getSnapshot().document!.getText("content").toString()).toBe("OFFLINE first\nlast");
}, 5_000);

test("closing during an outage retains unsaved frames and releases the session after retry", async () => {
  const f = await fixture();
  f.setOffline(true);
  f.session.getSnapshot().document!.getText("content").insert(0, "RETAIN ");
  await expect(f.session.close()).rejects.toThrow();
  expect(f.session.getSnapshot().pending).toBe(true);
  f.setOffline(false);
  await f.session.retry();
  await expect(f.session.start()).rejects.toThrow("closed");
  const peer = createNativeDocumentSession(f);
  cleanup.push(() => peer.close());
  await peer.start();
  expect(peer.getSnapshot().document!.getText("content").toString()).toBe("RETAIN first\nlast");
}, 5_000);
