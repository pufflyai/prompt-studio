import { join } from "node:path";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";

// The maintained Playwright runner is Node. Keep the Bun-only wire peer in its own process.
const root = process.argv[2]!;
const peer = createPackagedSyncPeer({
  key: Bun.file(join(root, "peer-key.pem")),
  cert: Bun.file(join(root, "peer-cert.pem")),
});
console.log(JSON.stringify({ type: "ready", origin: peer.origin }));
let buffered = "";
try {
  for await (const chunk of Bun.stdin.stream()) {
    buffered += new TextDecoder().decode(chunk);
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      const request = JSON.parse(line) as {
        id: number;
        operation: string;
        documentId: string;
        deviceId: string;
        blocked: boolean;
        state: Parameters<typeof peer.installSnapshot>[1];
      };
      try {
        let value: unknown;
        if (request.operation === "block-device") peer.blockDevice(request.deviceId, request.blocked);
        else if (request.operation === "trim") peer.trim(request.documentId);
        else if (request.operation === "capture-snapshot") value = peer.captureSnapshot(request.documentId);
        else if (request.operation === "install-snapshot") peer.installSnapshot(request.documentId, request.state);
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
        console.log(JSON.stringify({ id: request.id, ok: false, error: String(error) }));
      }
    }
  }
} finally {
  await peer.stop();
}
