import { expect, test } from "bun:test";
import { negotiate, protocolPeer } from "./compatibility";
import { replayBoundary } from "./state";

test("independently released peers negotiate a common wire protocol", () => {
  expect(
    negotiate(
      { ...protocolPeer, release: "runtime-0.1" },
      { ...protocolPeer, release: "relay-0.9", protocolVersions: [2, 1] },
    ),
  ).toEqual({ status: "compatible", protocolVersion: 2 });
});

test("unsupported versions and required features give an actionable recoverable result", () => {
  for (const peer of [
    { ...protocolPeer, protocolVersions: [1] },
    { ...protocolPeer, requiredFeatures: ["future-required"] },
  ]) {
    const result = negotiate(protocolPeer, peer);
    expect(result.status).toBe("unsupported-protocol");
    expect("recoverable" in result && result.recoverable).toBe(true);
    expect("action" in result && result.action).toContain("Update");
  }
});

test("compaction boundaries and restore epochs require snapshots rather than ambiguous replay", () => {
  const current = { epoch: "restored", sequence: 10 };
  expect(replayBoundary({ epoch: "old", sequence: 10 }, current, 5).status).toBe("snapshot-required");
  expect(replayBoundary({ epoch: "restored", sequence: 4 }, current, 5).status).toBe("snapshot-required");
  expect(replayBoundary({ epoch: "restored", sequence: 11 }, current, 5).status).toBe("snapshot-required");
  expect(replayBoundary({ epoch: "restored", sequence: 5 }, current, 5).status).toBe("replay");
});

test("malformed replay positions require a snapshot", () => {
  const current = { epoch: "current", sequence: 10 };
  for (const sequence of [Number.NaN, 0.5, -1, Number.POSITIVE_INFINITY]) {
    expect(replayBoundary({ ...current, sequence }, current, 0).status).toBe("snapshot-required");
  }
});
