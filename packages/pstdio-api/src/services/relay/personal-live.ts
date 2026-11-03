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
  ready: () => void;
}) => {
  let closed = false;
  let topic: { spaceOwner: string | null; topic: string } | undefined;
  let release: (() => void) | undefined;
  const stop = input.live.listen((event) => {
    if (event.type === "event") void input.received(event).catch(() => {});
    if (event.type === "subscribed" && event.topic === topic?.topic && event.spaceOwner === topic.spaceOwner)
      input.ready();
    let documentId: string | undefined;
    if (event.type === "changed" || event.type === "discovered") documentId = event.documentId;
    if (event.type === "subscribed") documentId = event.topic;
    if (documentId && input.owns(documentId)) input.changed();
  });
  return {
    async prepare(space: SyncSpace) {
      if (closed) return;
      const next = { spaceOwner: space.spaceOwner, topic: await personalLiveTopic(space) };
      if (closed || (next.topic === topic?.topic && next.spaceOwner === topic.spaceOwner)) return;
      release?.();
      release = input.live.subscribe(next);
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
