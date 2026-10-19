import { expect, test } from "bun:test";
import type { ConformanceFactory } from "./reference";
import { conflicted, textEdit } from "./suite";

export function registerResolutionCases(factory: ConformanceFactory) {
  test("a replacement resolution captures ancestry while edits outside its capture remain pending until accepted", async () => {
    const { b, conflictId } = await conflicted(factory);
    const replacement = await b.resolve(conflictId, "local");
    const later = await b.edit([textEdit("note", "after-resolution")]);
    expect(later.parents).toContain(replacement.operationId);
    expect(later.parents).not.toContain(conflictId);
    expect(replacement.resolution!.capturedOperationIds).not.toContain(later.operationId);
    await b.sync();
    const state = await b.state();
    expect(state.records.note.text).toContain("after-resolution");
    expect(state.pending).toHaveLength(0);
  });
  test("a late third client's edit invalidates old input revisions and a new resolution preserves all work", async () => {
    const { b, c, conflictId } = await conflicted(factory);
    const old = await b.resolve(conflictId, "local");
    await c.edit([textEdit("note", "third-client")]);
    await c.sync();
    const rejected = await b.sync();
    expect(rejected.outcomes.at(-1)?.status).toBe("conflict");
    const before = await b.state();
    expect(before.pending.some((mutation) => mutation.operationId === old.operationId)).toBe(true);
    expect(before.records.note.text).toContain("third-client");
    const fresh = await b.resolve(conflictId, "local");
    expect(fresh.parents).toContain(old.operationId);
    await b.sync();
    const state = await b.state();
    expect(state.pending).toHaveLength(0);
    for (const word of ["remote", "local", "third-client"]) expect(state.records.note.text).toContain(word);
  });
  test("a late competing resolution cannot overwrite the accepted resolution", async () => {
    const { b, c, conflictId } = await conflicted(factory);
    await c.sync();
    await b.resolve(conflictId, "local");
    const late = await c.resolve(conflictId, "remote");
    await b.sync();
    const accepted = await b.state();
    const stale = await c.sync();
    expect(stale.outcomes.find((receipt) => receipt.operationId === late.operationId)?.status).toBe("conflict");
    expect((await c.state()).records.note).toEqual(accepted.records.note);
    expect((await c.state()).pending.some((mutation) => mutation.operationId === late.operationId)).toBe(true);
    const retained = (await c.state()).accepted.conflicts[late.operationId];
    expect(retained?.resolvedBy).toBeUndefined();
    expect(retained?.alternativeOperationIds).toContain(late.operationId);
    await c.resolve(late.operationId, "local");
    await c.sync();
    expect((await c.state()).pending).toHaveLength(0);
  });
  test("handler proposals pin the published package and exact conflict/input revisions", async () => {
    const { b, relay, scope, conflictId } = await conflicted(factory);
    await b.resolve(conflictId, "local", { publishedRevision: "published-1", handlerId: "merge" });
    await relay.publish(scope, "published-2");
    expect((await b.sync()).outcomes.at(-1)?.reason).toBe("stale published handler revision");
    const proposal = await b.resolve(conflictId, "local", { publishedRevision: "published-2", handlerId: "merge" });
    expect(proposal.resolution!.expectedInputs).toHaveLength(proposal.changes.length);
    await b.sync();
    expect((await b.state()).pending).toHaveLength(0);
  });
}

export function registerJoinedResolutionCase(factory: ConformanceFactory) {
  test("joined conflicts capture every prerequisite group and validate every conflict revision", async () => {
    const {
      clients: [a, b],
      relay,
    } = factory();
    await a.edit([
      { ...textEdit("one", "base"), asset: await a.asset("base-one") },
      { ...textEdit("two", "base"), asset: await a.asset("base-two") },
    ]);
    await a.sync();
    await b.sync();
    await a.edit([
      { recordId: "one", asset: await a.asset("remote-one") },
      { recordId: "two", asset: await a.asset("remote-two") },
    ]);
    const first = await b.edit([{ recordId: "one", asset: await b.asset("local-one") }]);
    const second = await b.edit([
      { recordId: "two", asset: await b.asset("local-two") },
      textEdit("sibling", "whole-prerequisite"),
    ]);
    const joined = await b.edit([textEdit("one", "joined-one"), textEdit("two", "joined-two")]);
    await a.sync();
    await b.sync();
    const proposal = await b.resolve(first.operationId, "local");
    expect(proposal.resolution!.capturedOperationIds).toEqual([
      first.operationId,
      second.operationId,
      joined.operationId,
    ]);
    expect(proposal.resolution!.expectedConflicts).toHaveLength(2);
    expect(proposal.changes.map((change) => change.recordId)).toContain("sibling");
    const { sealMutation } = await import("../fingerprint");
    const incomplete = await sealMutation({
      ...proposal,
      sequence: proposal.sequence + 1,
      operationId: crypto.randomUUID(),
      parents: [first.operationId, joined.operationId],
      resolution: {
        ...proposal.resolution!,
        capturedOperationIds: [first.operationId, joined.operationId],
        expectedInputs: proposal.resolution!.expectedInputs.filter((input) => input.recordId !== "sibling"),
        expectedConflicts: proposal.resolution!.expectedConflicts.filter(
          (input) => input.conflictId === first.operationId,
        ),
      },
      changes: proposal.changes.filter((change) => change.recordId !== "sibling"),
    });
    expect((await relay.submit(incomplete)).reason).toBe("uncaptured unaccepted prerequisite");
    await b.sync();
    // Rejection changed the root's conflict revision, so recompute the full closure.
    await b.resolve(first.operationId, "local");
    await b.sync();
    const state = await b.state();
    expect(state.pending).toHaveLength(0);
    expect(state.records.sibling.text).toBe("whole-prerequisite");
    expect(state.records.one.text).toContain("joined-one");
    expect(state.records.two.text).toContain("joined-two");
  });
}

export function registerUncapturedAlternativeCase(factory: ConformanceFactory) {
  test("accepting one captured branch keeps another retained proposal inspectable and resolvable", async () => {
    const { a, b, c, conflictId } = await conflicted(factory);
    await c.sync();
    const rejectedEarlier = await b.resolve(conflictId, "local");
    const other = await c.resolve(conflictId, "remote");
    await a.edit([textEdit("note", "new-accepted")]);
    await a.sync();
    await b.sync();
    await c.sync();
    await b.sync();
    const replacement = await b.resolve(conflictId, "local");
    expect(replacement.resolution!.capturedOperationIds).not.toContain(other.operationId);
    await b.sync();
    await c.sync();
    const state = await c.state();
    expect(state.accepted.conflicts[other.operationId].resolvedBy).toBeUndefined();
    expect(state.pending.some((mutation) => mutation.operationId === other.operationId)).toBe(true);
    await c.resolve(other.operationId, "local");
    await c.sync();
    expect((await c.state()).pending).toHaveLength(0);
    expect((await c.state()).records.note.text).toContain("new-accepted");
    expect((await c.state()).accepted.conflicts[rejectedEarlier.operationId]).toBeUndefined();
    expect(Object.values((await c.state()).accepted.conflicts).filter((conflict) => !conflict.resolvedBy)).toHaveLength(
      0,
    );
  });
}

export function registerPrimitiveResolutionCase(factory: ConformanceFactory) {
  test("choosing the accepted primitive resolves a concurrent creation collision", async () => {
    const {
      clients: [a, b],
    } = factory();
    await a.edit([{ recordId: "record", shared: [{ kind: "map.set", key: "key", value: "accepted" }] }]);
    const branch = await b.edit([textEdit("record", "competing-text")]);
    await a.sync();
    await b.sync();
    expect((await b.state()).pending).toHaveLength(1);
    await b.resolve(branch.operationId, "remote");
    await b.sync();
    const state = await b.state();
    expect(state.pending).toHaveLength(0);
    expect(state.records.record.primitive).toBe("map");
    expect(state.records.record.map).toEqual({ key: "accepted" });
    expect(state.records.record.shared).toBeUndefined();
  });
}
