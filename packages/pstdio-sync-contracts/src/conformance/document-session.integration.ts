import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Y from "yjs";
import { sealCheckpoint } from "../checkpoint";
import { openDocumentSession } from "./document-session";

const paths: string[] = [];
afterEach(async () => {
  for (const path of paths.splice(0)) await rm(path, { recursive: true, force: true });
});
const create = async () => {
  const path = await mkdtemp(join(tmpdir(), "document-recovery-"));
  paths.push(path);
  const input = {
    path: join(path, "document.json"),
    scope: { accountId: "a", workbenchId: "w", extensionId: "e" },
    recordId: "doc",
    epoch: "restore",
    generation: 0,
  };
  return { path, input, session: await openDocumentSession(input) };
};
const prepare = async (session: Awaited<ReturnType<typeof openDocumentSession>>, generation = 0) => {
  const frozen = await session.freeze();
  const group = await sealCheckpoint({
    protocolVersion: 2,
    scope: { accountId: "a", workbenchId: "w", extensionId: "e" },
    epoch: "restore",
    generation: 0,
    environmentId: "a",
    sequence: Math.max(1, frozen.revision),
    parents: [],
    document: { recordId: "doc", generation, recoveryRevision: frozen.revision },
    changes: [
      { recordId: "doc", expectedRevision: 0, baseDeleted: false, shared: { kind: "text", update: frozen.update } },
    ],
  });
  await session.prepare(group, session.text());
  return { frozen: await session.freeze(), group };
};

test("atomic recovery replacement is acknowledged only after durability and later edits survive checkpoint reply", async () => {
  const { path, input, session } = await create();
  await session.edit(0, "first");
  const { frozen, group } = await prepare(session);
  await session.edit(5, " later");
  await session.complete(frozen.revision, group.fingerprint);
  await session.complete(frozen.revision, group.fingerprint);
  session.close();
  const recovered = await openDocumentSession(input);
  expect(recovered.text()).toBe("first later");
  expect(recovered.revision()).toEqual({ current: 2, checkpoint: 1 });
  expect(await readdir(path)).toEqual(["document.json"]);
  recovered.close();
});

test("a failed replacement keeps the last acknowledged recovery and the frozen retry identity", async () => {
  const { input, session } = await create();
  await session.edit(0, "saved");
  const { frozen } = await prepare(session);
  await expect(session.edit(5, " lost", "before-rename")).rejects.toThrow("replacement");
  session.close();
  const recovered = await openDocumentSession(input);
  expect(recovered.text()).toBe("saved");
  expect(await recovered.freeze()).toEqual(frozen);
  recovered.close();
});

test("peer state-vector exchange repairs dropped live frames without a durable per-edit ledger", async () => {
  const a = await create();
  const b = await create();
  await a.session.edit(0, "alpha");
  await b.session.edit(0, "beta");
  await a.session.receive(b.session.diff(a.session.vector()));
  await b.session.receive(a.session.diff(b.session.vector()));
  expect(a.session.text()).toBe(b.session.text());
  expect(a.session.text()).toContain("alpha");
  expect(a.session.text()).toContain("beta");
  a.session.close();
  b.session.close();
});

test("a coordinated generation rebuild bounds real Yjs structures across repeated sessions and rejects old positions", async () => {
  const { input, session } = await create();
  let current = session;
  await current.edit(0, "kept");
  const sizes: number[] = [];
  for (let cycle = 0; cycle < 8; cycle++) {
    // This case measures CRDT growth. The separate crash cases prove each recovery acknowledgement.
    await current.transact(
      Array.from({ length: 30 }, () => [
        { index: 0, text: "temporary" },
        { index: 0, count: 9 },
      ]).flat(),
    );
    const { frozen, group } = await prepare(current, cycle);
    const seedDoc = new Y.Doc();
    seedDoc.getText("body").insert(0, "kept");
    const rotation = {
      scope: input.scope,
      epoch: input.epoch,
      documentId: input.recordId,
      previousGeneration: cycle,
      generation: cycle + 1,
      seed: Buffer.from(Y.encodeStateAsUpdate(seedDoc)).toString("base64"),
    };
    seedDoc.destroy();
    await expect(current.rebase(rotation)).rejects.toThrow("barrier");
    await current.complete(frozen.revision, group.fingerprint);
    const oldFrame = current.diff(new Uint8Array([0]));
    const oldPosition = current.position(2);
    await current.rebase(rotation);
    await expect(current.receive(oldFrame)).rejects.toThrow("generation");
    expect(() => current.resolvePosition(oldPosition)).toThrow("generation");
    expect(current.resolvePosition(current.position(2))).toBe(2);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, current.state());
    expect(doc.store.clients.size).toBe(1);
    expect(Y.decodeUpdate(current.state()).structs).toHaveLength(1);
    expect(current.text()).toBe("kept");
    sizes.push(current.state().byteLength);
    doc.destroy();
    current.close();
    current = await openDocumentSession({ ...input, generation: cycle + 1 });
  }
  expect(Math.max(...sizes)).toBeLessThan(40);
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(4);
  current.close();
});
