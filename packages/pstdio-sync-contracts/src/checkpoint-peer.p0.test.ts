import { expect, test } from "bun:test";
import { checkpointPeer, negotiateCheckpoint } from "./checkpoint-peer";
import { protocolPeer } from "./compatibility";

test("checkpoint peers reject old alpha and unknown required features without a fallback", () => {
  expect(negotiateCheckpoint(checkpointPeer, checkpointPeer)).toEqual({ status: "compatible", protocolVersion: 2 });
  expect(negotiateCheckpoint(checkpointPeer, protocolPeer)).toMatchObject({
    status: "unsupported-protocol",
    recoverable: true,
  });
  expect(negotiateCheckpoint({ ...checkpointPeer, requiredFeatures: ["unknown"] }, checkpointPeer)).toMatchObject({
    status: "unsupported-protocol",
  });
});
