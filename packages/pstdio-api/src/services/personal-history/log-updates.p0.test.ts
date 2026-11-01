import { expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync";
import { logRelayFixture } from "./log-transport.fixture";
import { publishLogUpdate, readLogUpdate } from "./log-updates";

test("escape-heavy messages choose blobs using the final encrypted-frame input size", async () => {
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const peer = logRelayFixture();
  const id = await space.documentId("escape-heavy");
  const lines = ["\\".repeat(400_000)];
  await publishLogUpdate(space, id, peer.relay(id), lines);
  expect(peer.blobs.size).toBe(1);
  const update = peer.updates.get(id)![0]!;
  expect(Buffer.from(update.payload, "base64").byteLength).toBeLessThan(1_048_576);
  expect(await readLogUpdate(space, id, peer.relay(id), update)).toEqual(lines);
});
