import type { LiveConnection } from "pstdio-sync/relay";
import { createNativeDocumentLive } from "./native-document-live";

/** Presence follows the shared socket independently of any held durable document job. */
export const createNativeDocumentChannel = (
  input: Omit<Parameters<typeof createNativeDocumentLive>[0], "subscribe" | "send"> & { channel: LiveConnection },
) => {
  const bridge = createNativeDocumentLive({
    ...input,
    subscribe: (topic, admitted) => {
      const stop = input.channel.listen((event) => {
        if (event.type === "subscribed" && event.spaceOwner === null && event.topic === topic) admitted();
      });
      const release = input.channel.subscribe({ spaceOwner: null, topic });
      return () => {
        stop();
        release();
      };
    },
    send: (message) => message.type === "publish" && input.channel.publish(message, message.payload),
  });
  const stop = input.channel.listen((event) => {
    if (event.type === "event") void bridge.receive(event).catch(() => {});
    if (event.type === "ready") bridge.republish();
    if (event.type === "disconnected") {
      if (event.reason === "renewal") bridge.renewAccess();
      else bridge.clearSpace();
    }
  });
  return {
    ...bridge,
    async close() {
      stop();
      await bridge.close();
    },
  };
};
