import { expect, test } from "bun:test";
import type { TextEditingEvent, TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import { applyTextEditorUpdate, mergeTextDocuments, readTextDocumentSeed, seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import type { GuestHost } from "./guest-host";
import { createTextEditingClient } from "./text-editing-client";
import { encodeTextBytes } from "./text-editing-codec";

test("queued renderer edits and edits during both history adoption opens retain their causal intent", async () => {
  const old = new Y.Doc({ gc: false });
  let canonical = new Y.Doc({ gc: false });
  await seedTextDocument(old, "source");
  await seedTextDocument(canonical, "source");
  const oldSeed = (await readTextDocumentSeed(old)).id;
  const newSeed = (await readTextDocumentSeed(canonical)).id;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const recoverEntered = Promise.withResolvers<void>();
  const recoverRelease = Promise.withResolvers<void>();
  const histories = new Set<Y.Doc>([old, canonical]);
  let memberId = "";
  let opens = 0;
  let revision = 1;
  let room = old;
  const listeners = new Set<(event: TextEditingEvent) => void>();
  const wire = async () => ({
    state: encodeTextBytes(Y.encodeStateAsUpdate(canonical)),
    seedId: newSeed,
    sourceSeedId: (await readTextDocumentSeed(room)).id,
    sourceState: room === canonical ? undefined : encodeTextBytes(Y.encodeStateAsUpdate(room)),
    revision,
    editable: true,
  });
  const integrate = async () => {
    canonical = await mergeTextDocuments(room, canonical);
    histories.add(canonical);
  };
  const host = {
    onEvent: (_scope: string, listener: (event: TextEditingEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    call: async (_name: string, input: TextEditingRequest) => {
      if (input.operation === "open") {
        memberId = input.memberId;
        if (++opens === 1)
          return {
            handle: "member",
            grant: { token: "grant" },
            snapshot: {
              state: encodeTextBytes(Y.encodeStateAsUpdate(old)),
              seedId: oldSeed,
              sourceSeedId: oldSeed,
              revision,
              editable: true,
            },
          };
        if (opens === 2) {
          entered.resolve();
          await release.promise;
        }
        if (input.sourceState) {
          room = new Y.Doc({ gc: false });
          histories.add(room);
          Y.applyUpdate(room, Buffer.from(input.sourceState, "base64"));
          if (input.pendingUpdate) {
            applyTextEditorUpdate(room, Buffer.from(input.pendingUpdate, "base64"));
            await integrate();
            revision++;
            recoverEntered.resolve();
            await recoverRelease.promise;
          }
        } else room = canonical;
        return { handle: "member", grant: { token: "grant" }, snapshot: await wire() };
      }
      if (input.operation === "submit") {
        applyTextEditorUpdate(room, Buffer.from(input.update, "base64"));
        if (room !== canonical) await integrate();
        revision++;
        return wire();
      }
    },
  } as GuestHost;
  const session = await createTextEditingClient(host).open({ sourceId: "body", params: {} });
  let queuedRenderer = true;
  const stopReceive = session.beforeReceive(() => {
    if (!queuedRenderer) return;
    queuedRenderer = false;
    session.transact((text) => text.insert(0, "renderer "));
  });
  const adopted = Promise.withResolvers<void>();
  const stop = session.subscribe(() => {
    const state = session.getSnapshot();
    if (state.historyId === newSeed && !state.pending) adopted.resolve();
  });
  try {
    revision = 2;
    for (const listener of listeners)
      listener({ type: "snapshot", memberId, handle: "member", version: 1, snapshot: await wire() });
    await entered.promise;
    session.transact((text) => text.insert(0, "during rejoin "));
    release.resolve();
    await recoverEntered.promise;
    session.transact((text) => text.insert(text.length, " during recovery"));
    recoverRelease.resolve();
    await session.flush();
    await adopted.promise;
    expect(session.getSnapshot().text.toString()).toBe("during rejoin renderer source during recovery");
    expect(canonical.getText("content").toString()).toBe(session.getSnapshot().text.toString());
    expect(session.getSnapshot().pending).toBe(false);
    await session.close();
  } finally {
    stopReceive();
    stop();
    for (const document of histories) document.destroy();
  }
});
