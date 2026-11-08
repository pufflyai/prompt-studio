import { join } from "node:path";
import { createInterface } from "node:readline";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";

// The maintained Playwright runner is Node. Keep the Bun-only wire peer in its own process.
const root = process.argv[2]!;
const peer = createPackagedSyncPeer({
  key: Bun.file(join(root, "peer-key.pem")),
  cert: Bun.file(join(root, "peer-cert.pem")),
});
console.log(JSON.stringify({ type: "ready", origin: peer.origin }));
const commands = createInterface({ input: process.stdin });
try {
  for await (const line of commands) {
    const request = JSON.parse(line) as {
      id: number;
      operation: string;
      documentId: string;
      deviceId: string;
      blocked: boolean;
      enabled: boolean;
      state: Parameters<typeof peer.installSnapshot>[1];
    };
    try {
      let value: unknown;
      if (request.operation === "early-access") peer.setEarlyAccess(request.enabled);
      else if (request.operation === "block-device") peer.blockDevice(request.deviceId, request.blocked);
      else if (request.operation === "trim") peer.trim(request.documentId);
      else if (request.operation === "capture-snapshot") {
        console.error("Relay capture-snapshot: received");
        value = peer.captureSnapshot(request.documentId);
      } else if (request.operation === "install-snapshot") peer.installSnapshot(request.documentId, request.state);
      else if (request.operation === "stop") await peer.stop();
      else if (request.operation === "restart") peer.restart();
      else if (request.operation === "inspect") {
        value = {
          documents: [...peer.documents],
          retainedStates: peer.retainedStates(),
          blobs: peer.blobContents().map((bytes) => Buffer.from(bytes).toString("base64")),
        };
      } else throw new Error("Unknown relay control operation");
      console.log(JSON.stringify({ id: request.id, ok: true, value }));
    } catch (error) {
      console.error(`Relay control ${request.operation}: rejected`);
      console.log(JSON.stringify({ id: request.id, ok: false, error: String(error) }));
      console.error(`Relay control ${request.operation}: response written`);
    }
  }
} finally {
  commands.close();
  await peer.stop();
}
