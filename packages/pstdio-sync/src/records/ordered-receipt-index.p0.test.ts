import { expect, test } from "bun:test";
import { createSyncSpace } from "../encryption";
import type { OrderedReceipt } from "../relay/ordered-stream-entry";
import { createOrderedReceiptIndex, type OrderedIndexBlobs } from "./ordered-receipt-index";

const space = await createSyncSpace({
  projectId: "receipt-index",
  spaceOwner: null,
  keys: [{ generation: 1, secret: "A".repeat(43) }],
});
const fixture = () => {
  const stored = new Map<string, Uint8Array>();
  const children = new Map<string, string[]>();
  const requests = { reads: 0, writes: 0 };
  const blobs: OrderedIndexBlobs = {
    async put(id, bytes, refs) {
      if (refs.some((child) => !stored.has(child))) throw new Error("Missing manifest child");
      requests.writes++;
      stored.set(id, bytes.slice());
      children.set(id, [...refs]);
    },
    async get(id, length) {
      requests.reads++;
      const bytes = stored.get(id);
      if (!bytes) throw new Error("Missing receipt page");
      if (bytes.length !== length) throw new Error("Wrong authenticated extent");
      return bytes.slice();
    },
  };
  return { index: createOrderedReceiptIndex({ space, blobs }), blobs, stored, children, requests };
};
const receipt = (
  operationId: string,
  epoch = "first-order",
  state: "accepted" | "refused" = "accepted",
): OrderedReceipt => ({
  decision: { operationId, epoch, state, fingerprint: "a".repeat(64) },
  admissionFingerprint: "b".repeat(64),
});

test("restored devices resolve exact epoch receipts and retained global identities from encrypted pages", async () => {
  const f = fixture();
  const first = receipt("never-visible-operation-name", "old-order", "refused");
  const second = receipt("never-visible-operation-name", "new-order");
  const root = await f.index.append(null, [first, second]);
  expect(root).not.toBeNull();
  const restored = createOrderedReceiptIndex({ space, blobs: f.blobs });
  expect(await restored.identity(root, first.decision.operationId)).toBe(first.decision.fingerprint);
  expect(await restored.receipt(root, "old-order", first.decision.operationId)).toEqual(first);
  expect(await restored.receipt(root, "new-order", first.decision.operationId)).toEqual(second);
  expect(await restored.receipt(root, "other-order", first.decision.operationId)).toBeUndefined();
  for (const bytes of f.stored.values())
    expect(new TextDecoder().decode(bytes)).not.toContain(first.decision.operationId);
});

test("retained identities and exact decisions cannot be rewritten; identical appends reuse the root", async () => {
  const f = fixture();
  const original = receipt("save");
  const root = await f.index.append(null, [original]);
  const writes = f.requests.writes;
  expect(await f.index.append(root, [structuredClone(original)])).toEqual(root);
  expect(f.requests.writes).toBe(writes);
  const changed = structuredClone(original);
  changed.decision.fingerprint = "c".repeat(64);
  await expect(f.index.append(root, [changed])).rejects.toThrow("identity");
  await expect(f.index.append(root, [receipt("save", "first-order", "refused")])).rejects.toThrow("immutable");
  const wrapper = structuredClone(original);
  wrapper.admissionFingerprint = "d".repeat(64);
  await expect(f.index.append(root, [wrapper])).rejects.toThrow("immutable");
  expect(await f.index.receipt(root, "first-order", "save")).toEqual(original);
});

test("a changed receipt rewrites only its index paths and lookup downloads only those paths", async () => {
  const f = fixture();
  const original = Array.from({ length: 2048 }, (_, i) => receipt(`save-${i}`));
  const root = await f.index.append(null, original);
  const priorIds = new Set(f.stored.keys());
  const writes = f.requests.writes;
  const extended = await f.index.append(root, [receipt("save-1024", "second-order")]);
  expect(extended).not.toEqual(root);
  expect(f.requests.writes - writes).toBeLessThan(12);
  const currentChildren = f.children.get(extended!.blobId)!;
  expect(currentChildren.some((id) => priorIds.has(id))).toBe(true);
  for (const refs of f.children.values()) expect(refs.length).toBeLessThanOrEqual(16);
  const restored = createOrderedReceiptIndex({ space, blobs: f.blobs });
  const reads = f.requests.reads;
  expect(await restored.receipt(extended, "second-order", "save-1024")).toEqual(receipt("save-1024", "second-order"));
  expect(f.requests.reads - reads).toBeLessThan(8);
  expect(JSON.stringify(extended).length).toBeLessThan(256);
});

test("an unavailable rooted page blocks lookup instead of proving a save absent", async () => {
  const f = fixture();
  const original = receipt("saved-before-backup");
  const root = await f.index.append(null, [original]);
  f.stored.delete(root!.blobId);
  const restored = createOrderedReceiptIndex({ space, blobs: f.blobs });
  await expect(restored.receipt(root, "first-order", original.decision.operationId)).rejects.toThrow(
    "Missing receipt page",
  );
  expect(await restored.receipt(null, "first-order", original.decision.operationId)).toBeUndefined();
});

test("a receipt page cache still enforces the parent's authenticated extent", async () => {
  const f = fixture();
  const root = (await f.index.append(null, [receipt("extent")]))!;
  await expect(f.index.receipt({ ...root, byteLength: root.byteLength + 1 }, "first-order", "extent")).rejects.toThrow(
    "extent",
  );
});

test("reading a receipt returns owned data rather than mutable canonical cache state", async () => {
  const f = fixture();
  const original = receipt("owned-result");
  const root = await f.index.append(null, [original]);
  const value = (await f.index.receipt(root, "first-order", "owned-result"))!;
  value.decision.state = "refused";
  expect(await f.index.receipt(root, "first-order", "owned-result")).toEqual(original);
});

test("receipt field order does not change its immutable logical identity", async () => {
  const f = fixture();
  const original = receipt("property-order");
  const root = await f.index.append(null, [original]);
  const reordered: OrderedReceipt = {
    admissionFingerprint: original.admissionFingerprint,
    decision: {
      fingerprint: original.decision.fingerprint,
      state: original.decision.state,
      epoch: original.decision.epoch,
      operationId: original.decision.operationId,
    },
  };
  expect(await f.index.append(root, [reordered])).toEqual(root);
});

test("an authenticated receipt page cannot supply another operation's decision or omit its identity binding", async () => {
  const f = fixture();
  const { createEncryptedManifestNodes } = await import("./ordered-receipt-index-blobs");
  const { fingerprint, jsonSchema } = await import("pstdio-sync-contracts");
  const nodes = createEncryptedManifestNodes(space, f.blobs);
  const original = receipt("looked-up-save");
  const key = await fingerprint([
    "ordered-receipts",
    "receipt",
    original.decision.operationId,
    original.decision.epoch,
  ]);
  const base = { version: 1, format: "ordered-receipts", type: "leaf", prefix: "" };
  const wrongAddress = await nodes.write(
    jsonSchema.parse({ ...base, entries: [{ key, value: { type: "receipt", receipt: receipt("different-save") } }] }),
    [],
  );
  await expect(f.index.receipt(wrongAddress, "first-order", "looked-up-save")).rejects.toThrow("address");
  await expect(f.index.receipt(wrongAddress, "first-order", "an-unrelated-save")).rejects.toThrow("address");
  const missingIdentity = await nodes.write(
    jsonSchema.parse({ ...base, entries: [{ key, value: { type: "receipt", receipt: original } }] }),
    [],
  );
  await expect(f.index.receipt(missingIdentity, "first-order", "looked-up-save")).rejects.toThrow("identity");
  await expect(f.index.append(missingIdentity, [original])).rejects.toThrow("identity");
});

test("malformed or damaged rooted pages block a lookup that would otherwise appear absent", async () => {
  const f = fixture();
  const { createEncryptedManifestNodes } = await import("./ordered-receipt-index-blobs");
  const nodes = createEncryptedManifestNodes(space, f.blobs);
  const malformed = await nodes.write(
    { version: 1, format: "ordered-receipts", type: "branch", prefix: "", children: {} },
    [],
  );
  await expect(f.index.receipt(malformed, "first-order", "missing")).rejects.toThrow("branch extent");
  const root = (await f.index.append(null, [receipt("canonical")]))!;
  f.stored.set(
    root.blobId,
    f.stored.get(root.blobId)!.map((byte, index) => (index === 20 ? byte ^ 1 : byte)),
  );
  const restored = createOrderedReceiptIndex({ space, blobs: f.blobs });
  await expect(restored.receipt(root, "first-order", "missing")).rejects.toThrow();
});

test("encrypted manifest nodes enforce authenticated extents even when a transport returns extra bytes", async () => {
  const f = fixture();
  const { createEncryptedManifestNodes } = await import("./ordered-receipt-index-blobs");
  const nodes = createEncryptedManifestNodes(space, { ...f.blobs, get: async (id) => f.stored.get(id)! });
  const root = await nodes.write({ payload: "private node" }, []);
  expect(await nodes.read(root)).toEqual({ payload: "private node" });
  await expect(nodes.read({ ...root, byteLength: root.byteLength - 1 })).rejects.toThrow("authenticated extent");
});

test("a backup without an admission resolves the first retained receipt without enumerating later epochs", async () => {
  const f = fixture();
  const original = receipt("before-admission-backup", "old-order", "refused");
  const initial = await f.index.append(null, [original]);
  const later = await f.index.append(initial, [receipt(original.decision.operationId, "new-order")]);
  const restored = createOrderedReceiptIndex({ space, blobs: f.blobs });
  expect(await restored.known(later, original.decision.operationId)).toEqual(original);
  expect(await restored.identity(later, original.decision.operationId)).toBe(original.decision.fingerprint);
  expect(await restored.receipt(later, "new-order", original.decision.operationId)).toEqual(
    receipt(original.decision.operationId, "new-order"),
  );
  expect(await restored.known(later, "never-saved")).toBeUndefined();
  expect(await restored.known(null, original.decision.operationId)).toBeUndefined();
});

test("a retained representative whose receipt page is unavailable cannot be silently replaced", async () => {
  const f = fixture();
  const { createEncryptedManifestNodes } = await import("./ordered-receipt-index-blobs");
  const { fingerprint } = await import("pstdio-sync-contracts");
  const original = receipt("representative", "old-order");
  const key = await fingerprint(["ordered-receipts", "identity", original.decision.operationId, null]);
  const nodes = createEncryptedManifestNodes(space, f.blobs);
  const root = await nodes.write(
    {
      version: 1,
      format: "ordered-receipts",
      type: "leaf",
      prefix: "",
      entries: [
        {
          key,
          value: { type: "identity", fingerprint: original.decision.fingerprint, epoch: original.decision.epoch },
        },
      ],
    },
    [],
  );
  const restored = createOrderedReceiptIndex({ space, blobs: f.blobs });
  await expect(restored.known(root, original.decision.operationId)).rejects.toThrow("receipt");
  await expect(restored.append(root, [receipt(original.decision.operationId, "later-order")])).rejects.toThrow(
    "receipt",
  );
});

test("merging receipt roots retains both epoch histories and the preferred historical representative", async () => {
  const f = fixture();
  const first = receipt("shared-save", "preferred-order", "refused");
  const other = receipt("shared-save", "retained-order");
  const preferred = await f.index.append(null, [first, receipt("only-preferred")]);
  const retained = await f.index.append(null, [other, receipt("only-retained")]);
  const merged = await f.index.merge(preferred, retained);
  const restored = createOrderedReceiptIndex({ space, blobs: f.blobs });
  expect(await restored.known(merged, "shared-save")).toEqual(first);
  expect(await restored.receipt(merged, other.decision.epoch, "shared-save")).toEqual(other);
  expect(await restored.known(merged, "only-preferred")).toEqual(receipt("only-preferred"));
  expect(await restored.known(merged, "only-retained")).toEqual(receipt("only-retained"));
  expect(await restored.receipt(preferred, other.decision.epoch, "shared-save")).toBeUndefined();
});

test("root reconciliation reuses shared encrypted subtrees and rewrites only the divergent paths", async () => {
  const f = fixture();
  const base = await f.index.append(
    null,
    Array.from({ length: 1024 }, (_, i) => receipt(`baseline-${i}`)),
  );
  const preferred = await f.index.append(base, [receipt("preferred-addition")]);
  const retained = await f.index.append(base, [receipt("retained-addition")]);
  const reads = f.requests.reads;
  const writes = f.requests.writes;
  const merger = createOrderedReceiptIndex({ space, blobs: f.blobs });
  const merged = await merger.merge(preferred, retained);
  expect(f.requests.reads - reads).toBeLessThan(24);
  expect(f.requests.writes - writes).toBeLessThan(12);
  expect(await merger.known(merged, "preferred-addition")).toEqual(receipt("preferred-addition"));
  expect(await merger.known(merged, "retained-addition")).toEqual(receipt("retained-addition"));
  const unchangedWrites = f.requests.writes;
  expect(await merger.merge(merged, merged)).toEqual(merged);
  expect(f.requests.writes).toBe(unchangedWrites);
});

test("root reconciliation rejects changed global identities, decisions and unavailable pages", async () => {
  const f = fixture();
  const original = receipt("collision");
  const root = await f.index.append(null, [original]);
  const changed = structuredClone(original);
  changed.decision.fingerprint = "c".repeat(64);
  const badIdentity = await f.index.append(null, [changed]);
  await expect(f.index.merge(root, badIdentity)).rejects.toThrow("identity");
  const badDecision = await f.index.append(null, [receipt("collision", "first-order", "refused")]);
  await expect(f.index.merge(root, badDecision)).rejects.toThrow("immutable");
  const missing = (await f.index.append(null, [receipt("missing-page")]))!;
  f.stored.delete(missing.blobId);
  const restored = createOrderedReceiptIndex({ space, blobs: f.blobs });
  await expect(restored.merge(root, missing)).rejects.toThrow("Missing receipt page");
  await expect(restored.merge(missing, missing)).rejects.toThrow("Missing receipt page");
});

test("merging a covered older root reuses the preferred root without rewriting an equivalent tree", async () => {
  const f = fixture();
  for (const count of [1, 512]) {
    const retained = await f.index.append(
      null,
      Array.from({ length: count }, (_, index) => receipt(`covered-${count}-${index}`)),
    );
    const preferred = await f.index.append(retained, [receipt(`additional-${count}`)]);
    const writes = f.requests.writes;
    expect(await f.index.merge(preferred, retained)).toEqual(preferred);
    expect(f.requests.writes).toBe(writes);
  }
});
