import { expect, test } from "bun:test";
import type { Json } from "pstdio-sync-contracts";
import { createSyncSpace } from "../encryption";
import { createEncryptedManifestNodes, type OrderedIndexReference, readOrderedIndexReference } from "../relay";
import { createLogPageIndex } from "./log-page-index";

const fixture = async () => {
  const space = await createSyncSpace({
    projectId: "paged-log",
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const blobs = new Map<string, Uint8Array>();
  let reads = 0;
  let writes = 0;
  const nodes = createEncryptedManifestNodes(space, {
    put: async (id, bytes) => {
      writes++;
      blobs.set(id, bytes);
    },
    get: async (id) => {
      reads++;
      const bytes = blobs.get(id);
      if (!bytes) throw new Error("Missing log page");
      return bytes;
    },
  });
  return { nodes, index: createLogPageIndex(nodes), counts: () => ({ reads, writes }), blobs };
};
const row = (sequence: number, createdAt = "2026-11-04T00:00:00Z") => ({
  sequence,
  index: 0,
  entry: { id: `entry-${sequence}`, writerId: "device", createdAt, value: sequence },
});

test("newest log page reads follow tree depth, not the retained payload count", async () => {
  const f = await fixture();
  let root: OrderedIndexReference | null = null;
  for (let page = 0; page < 100; page++)
    root = await f.index.append(
      root,
      Array.from({ length: 100 }, (_, index) => row(page * 100 + index + 1)),
    );
  const before = f.counts();
  const page = await f.index.read(root, { sequence: 0, index: 0, limit: 10, newest: true, cutoff: 0 });
  expect(page.rows.map((item) => item.sequence)).toEqual(Array.from({ length: 10 }, (_, index) => 9991 + index));
  expect(f.counts().reads - before.reads).toBeLessThanOrEqual(13);
  const writes = f.counts().writes;
  await f.index.append(root, [row(10001)]);
  expect(f.counts().writes - writes).toBeLessThanOrEqual(4);
});

test("retention metadata skips expired payloads and a missing required page blocks reads", async () => {
  const f = await fixture();
  let root = await f.index.append(null, [row(1, "2026-01-01T00:00:00Z")]);
  root = await f.index.append(root, [row(2)]);
  const before = f.counts().reads;
  const result = await f.index.read(root, {
    sequence: 0,
    index: 0,
    limit: 50,
    cutoff: Date.parse("2026-10-01T00:00:00Z"),
  });
  expect(result.rows.map((item) => item.sequence)).toEqual([2]);
  expect(f.counts().reads - before).toBe(2);
  f.blobs.delete(root.blobId);
  await expect(f.index.read(root, { sequence: 0, index: 0, limit: 50, cutoff: 0 })).rejects.toThrow("Missing");
});

test("log index parents cannot misdescribe a child level or retained extent", async () => {
  const f = await fixture();
  const root = await f.index.append(null, [row(1)]);
  const child = {
    first: { sequence: 1, index: 0 },
    last: { sequence: 1, index: 0 },
    minTime: Date.parse("2026-11-04T00:00:00Z"),
    maxTime: Date.parse("2026-11-04T00:00:00Z"),
    count: 1,
    reference: root,
  };
  for (const invalid of [
    { level: 2, child },
    { level: 1, child: { ...child, count: 2 } },
  ]) {
    const parent = await f.nodes.write(
      { type: "append-log-index", version: 2, level: invalid.level, children: [invalid.child] } as unknown as Json,
      [root],
    );
    await expect(f.index.read(parent, { sequence: 0, index: 0, limit: 50, cutoff: 0 })).rejects.toThrow();
  }
});

test("archive metadata planning opens no candidate payload and materializes only selected identities", async () => {
  const f = await fixture();
  const root = await f.index.append(
    null,
    Array.from({ length: 6 }, (_, index) => row(index + 1)),
  );
  const before = f.counts().reads;
  const page = await f.index.plan(root, { sequence: 0, index: 0, limit: 3, newest: true, cutoff: 0 });
  expect(page.rows.map((entry) => entry.metadata.id)).toEqual(["entry-4", "entry-5", "entry-6"]);
  expect(f.counts().reads - before).toBe(1);
  const values = await f.index.materialize(page.rows.slice(1));
  expect(values.map((item) => item.entry.id)).toEqual(["entry-5", "entry-6"]);
  expect(f.counts().reads - before).toBe(3);
});

test("planned archive payloads recheck retention and authenticated identity before opening or caching", async () => {
  const f = await fixture();
  const root = await f.index.append(null, [row(1)]);
  const page = await f.index.plan(root, { sequence: 0, index: 0, limit: 1, cutoff: 0 });
  const before = f.counts().reads;
  expect(await f.index.materialize(page.rows, () => Date.parse("2026-12-01T00:00:00Z"))).toEqual([]);
  expect(f.counts().reads).toBe(before);
  const value = (await f.nodes.read(root)) as Record<string, Json>;
  const children = value.children as Record<string, Json>[];
  const child = children[0]!;
  const reference = readOrderedIndexReference(child.reference);
  const damaged = await f.nodes.write(
    {
      ...value,
      children: [{ ...child, metadata: { ...(child.metadata as Record<string, Json>), fingerprint: "0".repeat(64) } }],
    },
    [reference],
  );
  const bad = await f.index.plan(damaged, { sequence: 0, index: 0, limit: 1, cutoff: 0 });
  await expect(f.index.materialize(bad.rows)).rejects.toThrow("fingerprint");
});

test("the unreleased v1 log index is rejected explicitly without reading a payload fallback", async () => {
  const f = await fixture();
  const root = await f.nodes.write({ type: "append-log-index", version: 1, level: 0, children: [] }, []);
  await expect(f.index.plan(root, { sequence: 0, index: 0, limit: 1, cutoff: 0 })).rejects.toThrow("Unsupported");
});
