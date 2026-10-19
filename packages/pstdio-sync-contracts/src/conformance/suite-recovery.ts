import { expect, test } from "bun:test";
import { negotiate, protocolPeer } from "../compatibility";
import { sealMutation } from "../fingerprint";
import type { ConformanceFactory } from "./reference";
import { seed, textEdit } from "./suite";

export function registerRecoveryCases(factory: ConformanceFactory) {
  for (const order of [
    [0, 1],
    [1, 0],
  ])
    test(`old relay restore fences proposals and preserves their bytes in order ${order}`, async () => {
      const { clients, relay, scope } = factory();
      const [a, b] = clients;
      await seed(a, b);
      const saved = await relay.snapshot(scope);
      await a.edit([{ ...textEdit("note", "accepted-later"), asset: await a.asset("new-image") }]);
      await a.sync();
      await b.sync();
      await b.edit([textEdit("note", "pending-later")]);
      await a.restart();
      await b.restart();
      await relay.restore(saved);
      await expect(clients[order[0]].sync()).rejects.toThrow("Resynchronization required");
      await expect(clients[order[1]].sync()).rejects.toThrow("Resynchronization required");
      const current = await a.state();
      expect(current.records.note.text).toContain("accepted-later");
      expect((await b.state()).working.note.text).toContain("pending-later");
      expect((await relay.snapshot(scope)).checkpoint.epoch).not.toBe(saved.checkpoint.epoch);
    });
  test("restore preserves captured conflict ancestry without executing old epoch proposals", async () => {
    const {
      clients: [a, b],
      relay,
      scope,
    } = factory();
    await seed(a, b);
    const saved = await relay.snapshot(scope);
    await a.edit([{ ...textEdit("note", "remote"), asset: await a.asset("remote") }]);
    const root = await b.edit([{ ...textEdit("note", "local"), asset: await b.asset("local") }]);
    await a.sync();
    await b.sync();
    await b.resolve(root.operationId, "local");
    await b.sync();
    await b.edit([textEdit("note", "pending")]);
    await relay.restore(saved);
    await b.restart();
    await expect(b.sync()).rejects.toThrow("Resynchronization required");
    const state = await b.state();
    for (const word of ["remote", "local", "pending"]) expect(state.working.note.text).toContain(word);
    expect(state.pending.length).toBeGreaterThan(0);
    expect((await relay.snapshot(scope)).records).toEqual(saved.records);
  });
  test("unsupported peers leave durable queued work and bytes recoverable after restart", async () => {
    const {
      clients: [a],
      relay,
      scope,
    } = factory();
    const asset = await a.asset("queued");
    await a.edit([{ ...textEdit("note", "queued"), asset }]);
    const before = await a.state();
    const peer = { ...protocolPeer, release: "future-relay", protocolVersions: [1] };
    const outcome = await a.sync({ peer });
    expect(outcome.status).toBe("unsupported-protocol");
    expect("action" in outcome && outcome.action).toContain("Update");
    await a.restart();
    expect((await a.state()).pending).toEqual(before.pending);
    expect((await a.state()).blobs).toEqual(before.blobs);
    expect((await relay.snapshot(scope)).records).toEqual({});
    await a.sync();
    expect((await a.state()).pending).toHaveLength(0);
    expect(
      negotiate({ ...protocolPeer, release: "older-client" }, { ...protocolPeer, release: "newer-relay" }).status,
    ).toBe("compatible");
  });
  test("account, workbench, and extension identities isolate receipts and object bytes", async () => {
    const {
      clients: [a],
      relay,
      scope,
      objects,
    } = factory();
    const asset = await a.asset("private");
    const group = await a.edit([{ ...textEdit("note", "private"), asset }]);
    await a.sync();
    for (const field of ["accountId", "workbenchId", "extensionId"] as const) {
      const other = { ...scope, [field]: "other" };
      expect((await relay.snapshot(other)).records).toEqual({});
      expect(await objects.get(other, asset)).toBeNull();
      const boundary = await relay.snapshot(other);
      const isolated = await sealMutation({
        ...group,
        scope: other,
        epoch: boundary.checkpoint.epoch,
        generation: boundary.generation,
        changes: [textOnly(group.changes[0])],
      });
      expect((await relay.submit(isolated)).status).toBe("accepted");
    }
  });
}
function textOnly(change: Parameters<typeof sealMutation>[0]["changes"][number]) {
  const { asset: _asset, ...rest } = change;
  return rest;
}

export function registerReceiptRollbackCase(factory: ConformanceFactory) {
  test("restoring a pending receipt preserves newer accepted and pending bytes for resynchronization", async () => {
    const {
      clients: [a],
      relay,
      scope,
    } = factory();
    const asset = await a.asset("durable-image");
    const group = await a.edit([
      { ...textEdit("note", "accepted-later"), asset },
      textEdit("grouped", "also-accepted"),
    ]);
    expect((await relay.submit(group)).status).toBe("pending");
    const saved = await relay.snapshot(scope);
    await a.sync();
    expect((await a.state()).pending).toHaveLength(0);
    await a.edit([textEdit("note", "pending-later")]);
    await relay.restore(saved);
    await a.restart();
    await expect(a.sync()).rejects.toThrow("Resynchronization required");
    const state = await a.state();
    expect(state.pending.length).toBeGreaterThan(0);
    expect(state.records.note.text).toContain("accepted-later");
    expect(state.working.note.text).toContain("pending-later");
    expect(state.records.grouped.text).toBe("also-accepted");
    expect(state.blobs[asset.sha256]).toBe(Buffer.from("durable-image").toString("base64"));
  });
}
