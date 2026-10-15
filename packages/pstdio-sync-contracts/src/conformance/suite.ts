import { expect, test } from "bun:test";
import type { TestClient } from "./client";
import type { ConformanceFactory } from "./reference";
import { registerCollectionCases, registerDictionaryCase, registerMapAuthoringCases } from "./suite-collections";
import { registerReceiptRollbackCase, registerRecoveryCases } from "./suite-recovery";
import {
  registerJoinedResolutionCase,
  registerPrimitiveResolutionCase,
  registerResolutionCases,
  registerUncapturedAlternativeCase,
} from "./suite-resolutions";

export const textEdit = (recordId: string, text: string, index = 0) => ({
  recordId,
  shared: [{ kind: "text.insert" as const, index, text }],
});
export async function seed(a: TestClient, b: TestClient) {
  const asset = await a.asset("original");
  await a.edit([{ ...textEdit("note", "base"), asset }]);
  await a.sync();
  await b.sync();
}
export async function conflicted(factory: ConformanceFactory) {
  const scenario = factory();
  const [a, b, c] = scenario.clients;
  await seed(a, b);
  await c.sync();
  await a.edit([{ ...textEdit("note", " remote", 4), asset: await a.asset("remote") }]);
  const root = await b.edit([{ ...textEdit("note", " local", 4), asset: await b.asset("local") }]);
  await a.sync();
  await b.sync();
  return { ...scenario, a, b, c, conflictId: root.operationId };
}

export function registerConformance(factory: ConformanceFactory) {
  for (const order of [
    [0, 1],
    [1, 0],
  ]) {
    test(`mixed groups retain dependent edits and unrelated progress in reconnect order ${order}`, async () => {
      const { clients } = factory();
      const [a, b] = clients;
      await seed(a, b);
      const roots = await Promise.all(
        [a, b].map(async (client, index) =>
          client.edit([
            { ...textEdit("note", ` branch-${index}`, 4), asset: await client.asset(`image-${index}`) },
            textEdit("grouped", `group-${index}`),
          ]),
        ),
      );
      await a.edit([textEdit("note", " later-a"), textEdit("dependent", "a")]);
      await b.edit([textEdit("note", " later-b"), textEdit("dependent", "b")]);
      await clients[order[0]].sync();
      await clients[order[1]].sync();
      const loser = clients[order[1]];
      const state = await loser.state();
      expect(state.records.note.text).not.toContain(`branch-${order[1]}`);
      expect(state.records.grouped.text).not.toContain(`group-${order[1]}`);
      expect(state.working.note.text).toContain(`branch-${order[1]}`);
      expect(state.pending).toHaveLength(2);
      await loser.edit([textEdit("unrelated", "progress")]);
      await loser.sync();
      expect((await loser.state()).records.unrelated.text).toBe("progress");
      await loser.resolve(roots[order[1]].operationId, "remote");
      await loser.sync();
      const resolved = await loser.state();
      expect(resolved.records.note.text).toContain("later-a");
      expect(resolved.records.note.text).toContain("later-b");
      expect(resolved.records.grouped.text).toContain("group-0");
      expect(resolved.records.grouped.text).toContain("group-1");
      expect(resolved.records.dependent.text).toContain("a");
      expect(resolved.records.dependent.text).toContain("b");
      expect(resolved.pending).toHaveLength(0);
      await clients[order[0]].sync();
      expect((await clients[order[0]].state()).records.note).toEqual(resolved.records.note);
      expect(Object.keys(resolved.blobs)).toHaveLength(3);
    });
    test(`offline text survives client restart in reconnect order ${order}`, async () => {
      const {
        clients: [a, b],
      } = factory();
      const clients = [a, b];
      await seed(a, b);
      await a.edit([textEdit("note", " alpha", 4)]);
      await b.edit([textEdit("note", " beta", 4)]);
      await a.restart();
      await b.restart();
      await clients[order[0]].sync();
      await clients[order[1]].sync();
      await a.sync();
      await b.sync();
      expect((await a.state()).records.note.text).toEqual((await b.state()).records.note.text);
      expect((await a.state()).records.note.text).toContain("alpha");
      expect((await b.state()).records.note.text).toContain("beta");
    });
  }
  test("missing bytes withhold every record and retry publishes the whole group", async () => {
    const {
      clients: [a],
      relay,
      scope,
      objects,
    } = factory();
    const asset = await a.asset("missing bytes");
    const group = await a.edit([{ ...textEdit("one", "first"), asset }, textEdit("two", "second")]);
    expect((await relay.submit(group)).status).toBe("pending");
    expect((await relay.snapshot(scope)).records).toEqual({});
    await a.sync();
    expect((await a.state()).records.two.text).toBe("second");
    expect(new TextDecoder().decode((await objects.get(scope, asset))!)).toBe("missing bytes");
  });
  test("zero-byte assets publish the complete group and reach another client", async () => {
    const {
      clients: [a, b],
      objects,
      scope,
    } = factory();
    const asset = await a.asset("");
    await a.edit([{ ...textEdit("one", "first"), asset }, textEdit("two", "second")]);
    expect((await a.sync()).status).toBe("synchronized");
    expect((await a.state()).pending).toHaveLength(0);
    await b.sync();
    const state = await b.state();
    expect(state.records.one.text).toBe("first");
    expect(state.records.two.text).toBe("second");
    expect(Object.hasOwn(state.blobs, asset.sha256)).toBe(true);
    expect(state.blobs[asset.sha256]).toBe("");
    expect(await objects.get(scope, asset)).toEqual(new Uint8Array());
  });
  test("duplicate delivery retries safely and changed identity content is rejected", async () => {
    const {
      clients: [a],
      relay,
      scope,
    } = factory();
    const group = await a.edit([textEdit("note", "once")]);
    const first = await relay.submit(group);
    expect(await relay.submit(group)).toEqual(first);
    const { sealMutation } = await import("../fingerprint");
    const changed = await sealMutation({ ...group, parents: ["different"] });
    await expect(relay.submit(changed)).rejects.toThrow("identity reused");
    expect((await relay.snapshot(scope)).checkpoint.sequence).toBe(1);
  });
  for (const crash of ["before-commit", "after-commit"] as const)
    test(`commit/acknowledgment crash at ${crash} preserves atomic retry`, async () => {
      const {
        clients: [a],
        relay,
        scope,
      } = factory();
      await a.edit([textEdit("one", "first"), textEdit("two", "second")]);
      await expect(a.sync({ crash })).rejects.toThrow("crash");
      expect(Object.keys((await relay.snapshot(scope)).records)).toHaveLength(crash === "before-commit" ? 0 : 2);
      await a.sync();
      const state = await a.state();
      expect(state.records.one.text).toBe("first");
      expect(state.records.two.text).toBe("second");
      expect(state.pending).toHaveLength(0);
      expect(state.accepted.checkpoint.sequence).toBe(1);
    });
  test("out-of-order dependencies wait and concurrent local callers keep both journal entries", async () => {
    const {
      clients: [a],
      relay,
      scope,
    } = factory();
    const first = await a.edit([textEdit("note", "parent")]);
    const later = await a.edit([textEdit("note", "child")]);
    expect((await relay.submit(later)).status).toBe("pending");
    expect((await relay.snapshot(scope)).records).toEqual({});
    await relay.submit(first);
    expect((await relay.submit(later)).status).toBe("accepted");
    await a.sync();
    await Promise.all([a.edit([textEdit("note", "one")]), a.edit([textEdit("note", "two")])]);
    await a.sync();
    const state = await a.state();
    expect(state.pending).toHaveLength(0);
    for (const word of ["parent", "child", "one", "two"]) expect(state.records.note.text).toContain(word);
  });
  test("tombstones keep offline edits as retained alternatives", async () => {
    const {
      clients: [a, b],
    } = factory();
    await seed(a, b);
    await a.edit([{ recordId: "note", deleted: true }]);
    await b.edit([textEdit("note", "offline")]);
    await a.sync();
    await b.sync();
    const state = await b.state();
    expect(state.records.note.deleted).toBe(true);
    expect(state.working.note.text).toContain("offline");
    expect(state.pending).toHaveLength(1);
  });
  registerCollectionCases(factory);
  registerMapAuthoringCases(factory);
  registerDictionaryCase(factory);
  registerResolutionCases(factory);
  registerJoinedResolutionCase(factory);
  registerUncapturedAlternativeCase(factory);
  registerPrimitiveResolutionCase(factory);
  registerRecoveryCases(factory);
  registerReceiptRollbackCase(factory);
}
