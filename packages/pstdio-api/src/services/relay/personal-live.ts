import type { SyncSpace } from "pstdio-sync/encryption";
import type { LiveConnection } from "pstdio-sync/relay";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import { personalLiveTopic } from "../personal-history/live-messages";

/** One private topic carries transient snapshots; only small durable indexes retain subscriptions. */
export const createPersonalLive = (input: {
  live: LiveConnection;
  owns: (documentId: string) => boolean;
  received: (message: Extract<LiveServerMessage, { type: "event" }>) => Promise<void>;
  changed: () => void;
}) => {
  let closed = false;
  let topic: string | undefined;
  let release: (() => void) | undefined;
  const stop = input.live.listen((event) => {
    if (event.type === "event") void input.received(event).catch(() => {});
    let documentId: string | undefined;
    if (event.type === "changed" || event.type === "discovered") documentId = event.documentId;
    if (event.type === "subscribed") documentId = event.topic;
    if (documentId && input.owns(documentId)) input.changed();
  });
  return {
    async prepare(space: SyncSpace) {
      if (closed) return;
      const next = await personalLiveTopic(space);
      if (closed || next === topic) return;
      release?.();
      release = input.live.subscribe({ spaceOwner: space.spaceOwner, topic: next });
      topic = next;
    },
    send: (message: { spaceOwner: string | null; topic: string; payload: string }) => {
      if (!closed) input.live.publish(message, message.payload);
    },
    close() {
      if (closed) return;
      closed = true;
      stop();
      release?.();
    },
  };
};
