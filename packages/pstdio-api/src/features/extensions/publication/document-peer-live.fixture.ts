import { type LiveClientMessage, liveClientMessageSchema, liveProtocolVersion } from "pstdio-sync-contracts";

export interface PeerLiveData {
  discovery: Set<string | null>;
  deviceId: string;
  topics: Set<string>;
}
const topicKey = (spaceOwner: string | null, topic: string) => JSON.stringify([spaceOwner, topic]);

/** Subscription peer for the publication integration fixture; production routing has separate coverage. */
export const createDocumentPeerLive = (beforeSubscribe?: (deviceId: string, topic: string) => Promise<void>) => {
  const sockets = new Set<Bun.ServerWebSocket<PeerLiveData>>();
  const following = new Map<Bun.ServerWebSocket<PeerLiveData>, Set<string>>();
  const presence = (key: string) => {
    const [spaceOwner, topic] = JSON.parse(key);
    for (const [socket, topics] of following)
      if (topics.has(key))
        socket.send(
          JSON.stringify({
            type: "subscribers",
            spaceOwner,
            topic,
            active: [...sockets].some((reader) => reader !== socket && reader.data.topics.has(key)),
          }),
        );
  };
  const topicMessage = (
    socket: Bun.ServerWebSocket<PeerLiveData>,
    message: Extract<LiveClientMessage, { topic: string }>,
  ) => {
    const key = topicKey(message.spaceOwner, message.topic);
    if (message.type === "subscribe") {
      socket.subscribe(key);
      socket.data.topics.add(key);
    }
    if (message.type === "unsubscribe") {
      socket.unsubscribe(key);
      socket.data.topics.delete(key);
    }
    if (message.type === "follow") {
      const topics = following.get(socket) ?? new Set<string>();
      topics.add(key);
      following.set(socket, topics);
    }
    if (message.type === "unfollow") following.get(socket)?.delete(key);
    presence(key);
  };
  return {
    subscriptions: () =>
      [...sockets].map((socket) => ({ deviceId: socket.data.deviceId, topics: [...socket.data.topics] })),
    changed(
      notice: { spaceOwner: string | null; documentId: string; lastSequence: number; stateId: unknown },
      created: boolean,
    ) {
      const key = topicKey(notice.spaceOwner, notice.documentId);
      for (const socket of sockets) {
        if (socket.isSubscribed(key)) socket.send(JSON.stringify({ type: "changed", ...notice }));
        else if (created && socket.data.discovery.has(notice.spaceOwner))
          socket.send(JSON.stringify({ type: "discovered", ...notice }));
      }
    },
    handlers: {
      open(socket: Bun.ServerWebSocket<PeerLiveData>) {
        sockets.add(socket);
        socket.send(JSON.stringify({ type: "ready", protocolVersion: liveProtocolVersion }));
      },
      async message(socket: Bun.ServerWebSocket<PeerLiveData>, data: string | Buffer) {
        const message = liveClientMessageSchema.parse(JSON.parse(String(data)));
        if (message.type === "discover") socket.data.discovery.add(message.spaceOwner);
        if (message.type === "undiscover") socket.data.discovery.delete(message.spaceOwner);
        if (message.type === "subscribe" && beforeSubscribe) await beforeSubscribe(socket.data.deviceId, message.topic);
        if ("topic" in message) topicMessage(socket, message);
        if (message.type === "publish")
          socket.publish(
            topicKey(message.spaceOwner, message.topic),
            JSON.stringify({
              type: "event",
              spaceOwner: message.spaceOwner,
              topic: message.topic,
              payload: message.payload,
              deviceId: socket.data.deviceId,
            }),
          );
        if ("requestId" in message && message.requestId)
          socket.send(JSON.stringify({ type: "control-result", requestId: message.requestId, retryAfterMs: 0 }));
      },
      close(socket: Bun.ServerWebSocket<PeerLiveData>) {
        sockets.delete(socket);
        following.delete(socket);
        for (const key of socket.data.topics) presence(key);
      },
    },
  };
};
