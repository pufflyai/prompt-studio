import { afterAll, expect, test } from "bun:test";
import { fingerprint } from "../fingerprint";
import { createCoveredFixture } from "./covered-fixture";

const fixture = await createCoveredFixture();
afterAll(() => fixture.close());

for (const fault of ["before-commit", "after-commit"] as const) {
  test(`checkpoint ${fault} keeps one frozen retry and publishes projections together`, async () => {
    const f = await fixture.scenario();
    const group = await f.group("a", "first");
    await expect(f.submit(group, fault)).rejects.toThrow("commit");
    expect(Object.keys((await f.snapshot()).records)).toHaveLength(fault === "before-commit" ? 0 : 2);
    const receipt = await f.submit(group);
    expect(await f.submit(group)).toEqual(receipt);
    expect((await f.snapshot()).cut).toBe(1);
    await expect(f.submit(await f.reseal({ ...group, changes: group.changes.slice(0, 1) }))).rejects.toThrow();
  });
}

test("offline enrollment, recovery ancestry and incomplete backup stop the safe cut", async () => {
  const f = await fixture.scenario();
  await f.submit(await f.group("a", "base"));
  await f.cover(["a", "b"]);
  expect((await f.compact()).blockers).toContain("environment:c");
  await f.cover(["c"]);
  expect((await f.compact()).blockers).toContain("verified-backup");
  await f.backup();
  await f.submit(await f.group("a", "next"));
  await f.cover(["a", "b", "c"], { a: ["a:1"] });
  await f.backup();
  expect((await f.compact()).cut).toBe(0);
  expect((await f.snapshot()).receipts["a:1"]).toBeDefined();
});

test("current identities retain outcomes; covered floors and retired generations cannot execute again", async () => {
  const f = await fixture.scenario();
  const old = await f.group("a", "old");
  const receipt = await f.submit(old);
  await f.cover(["a", "b", "c"]);
  await f.backup();
  await f.compact();
  expect((await f.snapshot()).writers.a.floor).toBe(1);
  expect(Object.keys((await f.snapshot()).receipts)).toHaveLength(0);
  expect(await f.submit(old)).toMatchObject({ status: "resynchronize", proposal: old });
  await f.rotate();
  expect(await f.submit(old)).toMatchObject({ status: "resynchronize", proposal: old });
  expect((await f.snapshot()).cut).toBe("cut" in receipt ? receipt.cut! : -1);
});

test("pending and conflicting groups keep their complete ancestor asset closure", async () => {
  const f = await fixture.scenario();
  const base = await f.group("a", "base");
  await f.submit(base);
  const competing = await f.group("b", "alternative", 0);
  expect((await f.submit(competing)).status).toBe("conflict");
  const child = await f.group("b", "child", 0, ["b:1", "a:1"]);
  expect((await f.submit(child)).status).toBe("pending");
  await f.cover(["a", "b", "c"]);
  await f.backup();
  await f.compact();
  const snapshot = await f.snapshot();
  expect(Object.keys(snapshot.receipts).sort()).toEqual(["a:1", "b:1", "b:2"]);
  for (const group of [base, competing, child]) expect(await f.readAsset(group.changes[1].asset!.next!)).not.toBeNull();
  expect(await f.rotate()).toMatchObject({ status: "blocked" });
});

test("publication and backup pins are rechecked under deletion lock", async () => {
  const f = await fixture.scenario();
  const old = await f.group("a", "old");
  await f.submit(old);
  await f.submit(await f.group("a", "current"));
  await f.cover(["a", "b", "c"]);
  await f.backup();
  const asset = old.changes[1].asset!.next!;
  const pin = await f.pin([asset]);
  await f.compact();
  expect(await f.readAsset(asset)).not.toBeNull();
  await f.unpin(pin);
  await expect(f.compact("before-delete")).rejects.toThrow("delete");
  await f.compact();
  expect(await f.readAsset(asset)).toBeNull();
  await expect(f.pin([asset])).rejects.toThrow("incomplete");
});

test("new enrollment downloads current closure; verified backups restore without live objects into fresh epochs", async () => {
  const f = await fixture.scenario();
  const old = await f.group("a", "old");
  await f.submit(old);
  const earlier = await f.backup();
  const newer = await f.group("a", "newer");
  await f.submit(newer);
  expect(Object.keys((await f.snapshot()).receipts)).toHaveLength(2);
  expect(await f.enroll("__proto__")).toEqual([newer.changes[1].asset!.next!]);
  await f.cover(["a", "b", "c"]);
  const latest = await f.backup();
  expect((await f.compact()).cut).toBe(2);
  expect(await f.requiredAssets()).toEqual([newer.changes[1].asset!.next!]);
  await f.eraseLiveAssets();
  await f.restore(latest);
  expect(await f.readAsset(newer.changes[1].asset!.next!)).not.toBeNull();
  const epoch = (await f.snapshot()).epoch;
  await f.restore(earlier);
  expect((await f.snapshot()).epoch).not.toBe(epoch);
  expect(await f.readAsset(old.changes[1].asset!.next!)).not.toBeNull();
  expect(await f.submit(newer)).toMatchObject({ status: "resynchronize", proposal: newer });
});

test("coverage is scoped, authenticated and bound to the exact installed snapshot", async () => {
  const f = await fixture.scenario();
  await f.submit(await f.group("a", "base"));
  await expect(f.acknowledge("foreign", "a")).rejects.toThrow("authorization");
  await expect(f.acknowledge("a", "b")).rejects.toThrow("authorization");
  await expect(f.acknowledge("a", "a", { epoch: "old" })).rejects.toThrow("coverage");
  await expect(f.acknowledge("a", "a", { snapshotHash: "0".repeat(64) })).rejects.toThrow("coverage");
});

test("document rotation fences every enrolled writer and publishes one shared seed", async () => {
  const f = await fixture.scenario();
  await f.submit(await f.group("a", "accepted"));
  await f.cover(["a", "b", "c"]);
  await f.backup();
  await f.beginBarrier();
  await f.joinBarrier("a");
  await f.joinBarrier("b");
  expect(await f.rotate()).toMatchObject({ status: "blocked" });
  await expect(f.submit(await f.group("a", "late"))).rejects.toThrow("barrier");
  await f.joinBarrier("c");
  const old = await f.group("c", "delayed");
  const rotated = await f.rotate();
  expect(rotated.status).toBe("rotated");
  expect((await f.snapshot()).documents.document).toBe(1);
  expect(await f.submit(old)).toMatchObject({ status: "resynchronize", proposal: old });
});

test("active recovery blocks document retirement until checkpointed", async () => {
  const f = await fixture.scenario();
  await f.submit(await f.group("a", "accepted"));
  await f.cover(["a", "b", "c"]);
  await f.acknowledge("a", "a", {
    recovery: [{ recordId: "document", generation: 0, revision: 2, checkpointRevision: 1, baseCut: 0, branches: [] }],
  });
  await f.backup();
  expect((await f.compact()).blockers).toContain("recovery:a:document");
  expect((await f.compact()).cut).toBe(0);
  await f.beginBarrier();
  await expect(f.joinBarrier("a")).rejects.toThrow("Uncovered");
});

test("a publication pin acquired after retirement protects bytes at the deletion boundary", async () => {
  const f = await fixture.scenario();
  const old = await f.group("a", "old");
  await f.submit(old);
  await f.submit(await f.group("a", "current"));
  await f.cover(["a", "b", "c"]);
  await f.backup();
  const asset = old.changes[1].asset!.next!;
  const pins: string[] = [];
  await f.compact(undefined, async () => {
    pins.push(await f.pin([asset]));
  });
  expect(await f.readAsset(asset)).not.toBeNull();
  await f.unpin(pins[0]);
  await expect(f.compact("after-delete")).rejects.toThrow("after delete");
  expect((await f.snapshot()).records.projection.asset?.sha256).not.toBe(asset.sha256);
  await f.compact();
  expect(await f.readAsset(asset)).toBeNull();
});

test("repeated covered cycles bound receipts, writer metadata and live asset versions", async () => {
  const f = await fixture.scenario();
  for (let cycle = 0; cycle < 4; cycle++) {
    for (let edit = 0; edit < 4; edit++) await f.submit(await f.group("a", `value-${edit}`));
    await f.cover(["a", "b", "c"]);
    await f.backup();
    await f.beginBarrier();
    for (const id of ["a", "b", "c"]) await f.joinBarrier(id);
    expect((await f.rotate()).status).toBe("rotated");
    await f.cover(["a", "b", "c"]);
    await f.backup();
    await f.compact();
    const state = await f.snapshot();
    expect(Object.keys(state.receipts)).toHaveLength(0);
    expect(Object.keys(state.writers)).toHaveLength(3);
    expect(state.writers.a.floor).toBe((cycle + 1) * 4);
    expect(state.assets).toHaveLength(1);
  }
});

test("older backup restore preserves compacted newer local content and reports missing recovery bytes", async () => {
  const f = await fixture.scenario();
  await f.submit(await f.group("a", "old"));
  const earlier = await f.backup();
  const newer = await f.group("a", "newer");
  await f.submit(newer);
  await f.cover(["a", "b", "c"]);
  await f.backup();
  await f.compact();
  await f.cover(["a"]);
  expect(Object.keys((await f.snapshot()).receipts)).toHaveLength(0);
  await f.eraseLiveAssets();
  await f.restore(earlier);
  const recovered = await f.recoverLocal("a");
  expect(recovered.status).toBe("recovery-proposal");
  if (recovered.status === "current") throw new Error("Newer work must be proposed");
  expect(recovered.source.records.projection.asset).toEqual(newer.changes[1].asset!.next!);
  expect(recovered.source.epoch).not.toBe(recovered.target.epoch);
  await f.dropLocalBytes("a");
  expect((await f.recoverLocal("a")).status).toBe("recovery-unavailable");
  expect((await f.snapshot()).records.projection.value).toBe("old");
});

test("resolved alternatives and their outcome metadata retire together after coverage", async () => {
  const f = await fixture.scenario();
  await f.submit(await f.group("a", "base"));
  const alternative = await f.group("b", "alternative", 0);
  expect((await f.submit(alternative)).status).toBe("conflict");
  const state = await f.snapshot();
  const conflict = state.conflicts["b:1"];
  const proposal = await f.group("a", "resolved");
  const resolved = await f.reseal({
    ...proposal,
    parents: ["b:1"],
    resolution: {
      conflictId: "b:1",
      capturedOperationIds: ["b:1"],
      expectedConflicts: [{ conflictId: "b:1", revision: conflict.revision }],
      expectedInputs: proposal.changes.map((change) => ({
        recordId: change.recordId,
        revision: state.records[change.recordId].revision,
      })),
    },
  });
  expect((await f.submit(resolved)).status).toBe("accepted");
  await f.cover(["a", "b", "c"]);
  await f.backup();
  await f.compact();
  const retired = await f.snapshot();
  expect(retired.receipts).toEqual({});
  expect(retired.conflicts).toEqual({});
  expect(retired.writers.b.floor).toBe(1);
  expect(await f.submit(alternative)).toMatchObject({ status: "resynchronize" });
  expect(await f.submit(await f.group("a", "after floor", undefined, ["a:1"]))).toMatchObject({ status: "accepted" });
});

test("a branch based on a retired parent remains readable and resolvable", async () => {
  const f = await fixture.scenario();
  await f.submit(await f.group("a", "base"));
  await f.cover(["a", "b", "c"]);
  await f.backup();
  await f.compact();
  await f.submit(await f.group("b", "alternative", 0, ["a:1"]));
  const state = await f.snapshot();
  expect(state.receipts["b:1"].status).toBe("conflict");
  expect((await f.requiredAssets()).length).toBe(2);
  const proposal = await f.group("a", "resolved");
  expect(
    await f.submit(
      await f.reseal({
        ...proposal,
        parents: ["b:1"],
        resolution: {
          conflictId: "b:1",
          capturedOperationIds: ["b:1"],
          expectedConflicts: [{ conflictId: "b:1", revision: state.conflicts["b:1"].revision }],
          expectedInputs: proposal.changes.map((change) => ({
            recordId: change.recordId,
            revision: state.records[change.recordId].revision,
          })),
        },
      }),
    ),
  ).toMatchObject({ status: "accepted" });
});

test("retired pending proposals rebase with preserved preconditions and retire their exceptions", async () => {
  const f = await fixture.scenario();
  await f.submit(await f.group("a", "base"));
  const pending = await f.group("b", "proposal", undefined, ["a:2"]);
  expect(await f.submit(pending)).toMatchObject({ status: "pending" });
  const unrelated = await f.group("a", "unrelated");
  const awaitHashNull = await fingerprint(null);
  await f.submit(
    await f.reseal({
      ...unrelated,
      document: { ...unrelated.document, recordId: "unrelated" },
      changes: unrelated.changes.map((change) => ({
        ...change,
        recordId: change.recordId === "document" ? "unrelated" : "other-projection",
        expectedRevision: 0,
        ...(change.value && { value: { ...change.value, expected: awaitHashNull } }),
        ...(change.asset && { asset: { ...change.asset, base: null } }),
      })),
    }),
  );
  await f.cover(["a", "b", "c"]);
  await f.backup();
  await f.compact();
  expect(await f.submit(pending)).toMatchObject({ status: "resynchronize", proposal: pending });
  const retry = await f.group("b", "proposal", undefined, ["b:1", "a:2"]);
  const rebased = await f.reseal({
    ...retry,
    rebase: {
      expectedSnapshotHash: await f.snapshotHash(),
      sources: [{ operationId: "b:1", fingerprint: pending.fingerprint }],
    },
  });
  const asset = rebased.changes[1].asset!.next!;
  await f.eraseAsset(asset);
  expect(await f.submit(rebased)).toMatchObject({ status: "pending" });
  await f.upload(asset, new TextEncoder().encode("proposal"));
  expect(await f.submit(rebased)).toMatchObject({ status: "accepted" });
  await f.cover(["a", "b", "c"]);
  await f.backup();
  await f.compact();
  expect((await f.snapshot()).receipts).toEqual({});
});

test("opaque document IDs use the same generation fence as ordinary IDs", async () => {
  const f = await fixture.scenario();
  for (const recordId of ["constructor", "__proto__"]) {
    const group = await f.group("a", recordId);
    const changes = group.changes.map((change) => ({
      ...change,
      recordId: change.recordId === "document" ? recordId : change.recordId,
    }));
    expect(
      await f.submit(await f.reseal({ ...group, document: { ...group.document, recordId }, changes })),
    ).toMatchObject({ status: "accepted" });
    await f.acknowledge("a", "a", {
      recovery: [{ recordId, generation: 0, revision: 1, checkpointRevision: 1, baseCut: 0, branches: [] }],
    });
  }
});
