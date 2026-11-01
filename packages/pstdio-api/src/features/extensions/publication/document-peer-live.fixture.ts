import { type LiveClientMessage, liveClientMessageSchema, liveProtocolVersion } from "pstdio-sync-contracts";

export interface PeerLiveData {
  discovery: Set<string | null>;
}
const topicKey = (spaceOwner: string | null, topic: string) => JSON.stringify([spaceOwner, topic]);

/** Subscription peer for the publication integration fixture; production routing has separate coverage. */
export const createDocumentPeerLive = () => {
  const sockets = new Set<Bun.ServerWebSocket<PeerLiveData>>();
  const topicMessage = (
    socket: Bun.ServerWebSocket<PeerLiveData>,
    message: Extract<LiveClientMessage, { topic: string }>,
  ) => {
    const key = topicKey(message.spaceOwner, message.topic);
    if (message.type === "subscribe") socket.subscribe(key);
    if (message.type === "unsubscribe") socket.unsubscribe(key);
    if (message.type === "follow")
      socket.send(
        JSON.stringify({ type: "subscribers", spaceOwner: message.spaceOwner, topic: message.topic, active: false }),
      );
  };
  return {
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
      message(socket: Bun.ServerWebSocket<PeerLiveData>, data: string | Buffer) {
        const message = liveClientMessageSchema.parse(JSON.parse(String(data)));
        if (message.type === "discover") socket.data.discovery.add(message.spaceOwner);
        if (message.type === "undiscover") socket.data.discovery.delete(message.spaceOwner);
        if ("topic" in message) topicMessage(socket, message);
      },
      close(socket: Bun.ServerWebSocket<PeerLiveData>) {
        sockets.delete(socket);
      },
    },
  };
};
