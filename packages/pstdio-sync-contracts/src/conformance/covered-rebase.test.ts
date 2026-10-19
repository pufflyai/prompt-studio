import { expect, test } from "bun:test";
import { sealCheckpoint } from "../checkpoint";
import { validateRebase } from "./covered-rebase";
import { newCoveredState, snapshotHash } from "./covered-state";

async function setup() {
  const scope = { accountId: "a", workbenchId: "w", extensionId: "e" };
  const state = newCoveredState(scope);
  state.generation = 1;
  const source = await sealCheckpoint({
    protocolVersion: 2,
    scope,
    epoch: state.epoch,
    generation: 0,
    environmentId: "a",
    sequence: 1,
    parents: [],
    document: { recordId: "doc", generation: 0, recoveryRevision: 1 },
    changes: [
      { recordId: "doc", expectedRevision: 0, baseDeleted: false, shared: { kind: "text", update: "AAA=" } },
      {
        recordId: "projection",
        expectedRevision: 0,
        baseDeleted: false,
        shared: {
          kind: "map",
          entries: [{ key: "title", expected: "0".repeat(64), next: { kind: "set", value: "proposal" } }],
        },
        asset: { base: null, next: { sha256: "0".repeat(64), byteLength: 0, mediaType: "text/plain" } },
      },
    ],
  });
  state.receipts["a:1"] = { group: source, status: "pending", cut: null };
  const group = await sealCheckpoint({
    ...source,
    generation: 1,
    sequence: 2,
    parents: ["a:1"],
    rebase: {
      expectedSnapshotHash: await snapshotHash(state),
      sources: [{ operationId: "a:1", fingerprint: source.fingerprint }],
    },
  });
  return { state, group };
}

for (const facet of ["asset", "map"] as const)
  test(`rebase preserves original ${facet} edit preconditions`, async () => {
    const { state, group } = await setup();
    await validateRebase(state, group);
    const changed = structuredClone(group);
    if (facet === "asset") delete changed.changes[1].asset;
    else if (changed.changes[1].shared?.kind === "map") changed.changes[1].shared.entries[0].expected = "1".repeat(64);
    await expect(validateRebase(state, await sealCheckpoint(changed))).rejects.toThrow("preconditions");
  });

test("known pending recovery retries keep their originally validated snapshot intent", async () => {
  const { state, group } = await setup();
  await validateRebase(state, group);
  const previous = { group, status: "pending" as const, cut: null };
  state.receipts["a:2"] = previous;
  await validateRebase(state, group, previous);
});
