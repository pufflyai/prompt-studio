import * as Y from "yjs";

export const namedRootWireFixture = () => {
  const document = new Y.Doc();
  document.clientID = 7;
  const updates: Uint8Array[] = [];
  document.on("update", (update: Uint8Array) => updates.push(update));
  document.transact(() => {
    document.getMap("").set("value", "empty root name");
    document.getMap("record:é雪").set("title", "original");
    document.getText("text\0body").insert(0, "First\nSecond");
    document.getArray("list").push([1, "two", { three: true }]);
  });
  const initial = Y.encodeStateAsUpdate(document);
  const peer = new Y.Doc();
  peer.clientID = 11;
  Y.applyUpdate(peer, initial);
  // Decoding creates untyped roots. Export and relative positions must work
  // both before and after a caller retrieves their concrete shared type.
  const decoded = Y.encodeStateAsUpdate(peer);
  const position = Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(peer.getText("text\0body"), 3));
  peer.transact(() => {
    peer.getMap("").delete("value");
    peer.getMap("record:é雪").set("title", "offline");
    peer.getText("text\0body").delete(0, 2);
    peer.getArray("list").insert(1, ["inserted"]);
  });
  const pending = Y.encodeStateAsUpdate(peer, Y.encodeStateVector(document));
  Y.applyUpdate(document, pending);
  const encoded = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
  const fixture = {
    updates: updates.map(encoded),
    initial: encoded(initial),
    decoded: encoded(decoded),
    position: encoded(position),
    pending: encoded(pending),
    final: encoded(Y.encodeStateAsUpdate(document)),
    finalV2: encoded(Y.encodeStateAsUpdateV2(document)),
    vector: encoded(Y.encodeStateVector(document)),
  };
  document.destroy();
  peer.destroy();
  return fixture;
};
