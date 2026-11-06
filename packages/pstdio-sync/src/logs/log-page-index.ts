import { fingerprint, type Json, type StorageLogEntry } from "pstdio-sync-contracts";
import { type createEncryptedManifestNodes, type OrderedIndexReference, readOrderedIndexReference } from "../relay";
import { type LogEntryHeader, readLogEntryHeader } from "./log-entry-metadata";
import { readLogPayload } from "./log-wire";

export interface LogIndexedEntry {
  sequence: number;
  index: number;
  entry: StorageLogEntry;
}
export interface LogIndexedMetadata {
  sequence: number;
  index: number;
  metadata: LogEntryHeader;
  reference: OrderedIndexReference;
}
interface Position {
  sequence: number;
  index: number;
}
interface Child {
  first: Position;
  last: Position;
  minTime: number;
  maxTime: number;
  count: number;
  reference: OrderedIndexReference;
  metadata?: LogEntryHeader;
}
interface Node {
  type: "append-log-index";
  version: 2;
  level: number;
  children: Child[];
}
type Nodes = ReturnType<typeof createEncryptedManifestNodes>;
const compare = (a: Position, b: Position) => a.sequence - b.sequence || a.index - b.index;
const fields = (input: unknown, names: string[]) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid log index object");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== names.length || Object.keys(value).some((key) => !names.includes(key)))
    throw new Error("Invalid log index fields");
  return value;
};
const integer = (value: unknown, minimum = 0) => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error("Invalid log index number");
  return value as number;
};
const position = (input: unknown) => {
  const value = fields(input, ["sequence", "index"]);
  return { sequence: integer(value.sequence, 1), index: integer(value.index) };
};
const readChild = (input: unknown): Child => {
  const value = fields(input, [
    "first",
    "last",
    "minTime",
    "maxTime",
    "count",
    "reference",
    ...(input && typeof input === "object" && Object.hasOwn(input, "metadata") ? ["metadata"] : []),
  ]);
  const child = {
    first: position(value.first),
    last: position(value.last),
    minTime: integer(value.minTime),
    maxTime: integer(value.maxTime),
    count: integer(value.count, 1),
    reference: readOrderedIndexReference(value.reference),
    ...(value.metadata === undefined ? {} : { metadata: readLogEntryHeader(value.metadata) }),
  };
  if (compare(child.first, child.last) > 0 || child.minTime > child.maxTime)
    throw new Error("Invalid log index extent");
  return child;
};
const readNode = (input: unknown) => {
  const value = fields(input, ["type", "version", "level", "children"]);
  const level = integer(value.level);
  if (value.type === "append-log-index" && value.version !== 2) throw new Error("Unsupported append-log index version");
  if (
    value.type !== "append-log-index" ||
    value.version !== 2 ||
    level > 32 ||
    !Array.isArray(value.children) ||
    !value.children.length ||
    value.children.length > (level ? 32 : 100)
  )
    throw new Error("Invalid log index page");
  const children = value.children.map(readChild);
  for (const child of children) {
    if (level && child.metadata) throw new Error("A log branch cannot contain entry metadata");
    if (
      !level &&
      (!child.metadata ||
        child.count !== 1 ||
        compare(child.first, child.last) !== 0 ||
        child.minTime !== child.maxTime ||
        Date.parse(child.metadata.createdAt) !== child.minTime)
    )
      throw new Error("Invalid log leaf metadata");
  }
  for (let index = 1; index < children.length; index++)
    if (compare(children[index - 1]!.last, children[index]!.first) >= 0) throw new Error("Log index pages overlap");
  return { type: "append-log-index" as const, version: 2 as const, level, children };
};
const readEntry = (input: unknown) => {
  const value = fields(input, ["sequence", "index", "entry"]);
  const entry = fields(value.entry, ["id", "writerId", "createdAt", "value"]);
  if (
    typeof entry.id !== "string" ||
    !entry.id ||
    typeof entry.writerId !== "string" ||
    !entry.writerId ||
    typeof entry.createdAt !== "string" ||
    !Number.isFinite(Date.parse(entry.createdAt))
  )
    throw new Error("Invalid log payload");
  return {
    sequence: integer(value.sequence, 1),
    index: integer(value.index),
    entry: entry as unknown as StorageLogEntry,
  };
};

/** Copy-on-write ordered metadata; entry payloads are separate so expired entries are never fetched. */
export const createLogPageIndex = (nodes: Nodes) => {
  const loadNode = async (reference: OrderedIndexReference) => {
    const node = readNode(await nodes.read(reference));
    await nodes.retain(
      reference,
      node.children.map((child) => child.reference),
    );
    return node;
  };
  const describe = (reference: OrderedIndexReference, children: Child[]) => ({
    reference,
    first: children[0]!.first,
    last: children.at(-1)!.last,
    count: children.reduce((sum, child) => sum + child.count, 0),
    minTime: Math.min(...children.map((child) => child.minTime)),
    maxTime: Math.max(...children.map((child) => child.maxTime)),
  });
  const checkedNode = async (reference: OrderedIndexReference, expected?: { level: number; extent: Child }) => {
    const node = await loadNode(reference);
    if (!expected) return node;
    if (node.level !== expected.level) throw new Error("Log index child level differs from its parent");
    const actual = describe(reference, node.children);
    const extent = expected.extent;
    if (
      compare(actual.first, extent.first) ||
      compare(actual.last, extent.last) ||
      actual.count !== extent.count ||
      actual.minTime !== extent.minTime ||
      actual.maxTime !== extent.maxTime
    )
      throw new Error("Log index child extent differs from its parent");
    return node;
  };
  const saveNode = async (level: number, children: Child[]) => {
    const node: Node = { type: "append-log-index", version: 2, level, children };
    const reference = await nodes.write(
      node as unknown as Json,
      children.map((child) => child.reference),
    );
    return describe(reference, children);
  };
  const appendTo = async (node: Node, added: Child[], existing?: OrderedIndexReference): Promise<Child[]> => {
    const children = [...node.children];
    if (node.level) {
      const last = children.pop()!;
      const expanded = await appendTo(
        await checkedNode(last.reference, { level: node.level - 1, extent: last }),
        added,
        last.reference,
      );
      children.push(...expanded);
    } else children.push(...added);
    const capacity = node.level ? 32 : 100;
    const saved = [];
    for (let offset = 0; offset < children.length; offset += capacity) {
      const batch = children.slice(offset, offset + capacity);
      const unchanged =
        offset === 0 &&
        existing &&
        batch.length === node.children.length &&
        batch.every((child, index) => child.reference.blobId === node.children[index]!.reference.blobId);
      saved.push(unchanged ? describe(existing!, batch) : await saveNode(node.level, batch));
    }
    return saved;
  };
  const select = async (
    root: OrderedIndexReference,
    options: { sequence: number; index: number; limit: number; newest?: boolean; cutoff: number },
  ) => {
    const selected: Child[] = [];
    const visit = async (reference: OrderedIndexReference, expected?: { level: number; extent: Child }) => {
      const node = await checkedNode(reference, expected);
      const children = options.newest ? [...node.children].reverse() : node.children;
      for (const child of children) {
        if (child.maxTime < options.cutoff || (!options.newest && compare(child.last, options) <= 0)) continue;
        if (node.level) await visit(child.reference, { level: node.level - 1, extent: child });
        else selected.push(child);
        if (selected.length > options.limit) return;
      }
    };
    await visit(root);
    return selected;
  };
  const pruneNode = async (
    reference: OrderedIndexReference,
    cutoff: number,
    expected?: { level: number; extent: Child },
  ): Promise<Child | null> => {
    const node = await checkedNode(reference, expected);
    const kept: Child[] = [];
    let changed = false;
    for (const child of node.children) {
      if (child.maxTime < cutoff) {
        changed = true;
        continue;
      }
      if (node.level && child.minTime < cutoff) {
        const next = await pruneNode(child.reference, cutoff, { level: node.level - 1, extent: child });
        changed = true;
        if (next) kept.push(next);
      } else kept.push(child);
    }
    if (!kept.length) return null;
    if (!changed)
      return {
        reference,
        first: kept[0]!.first,
        last: kept.at(-1)!.last,
        minTime: Math.min(...kept.map((child) => child.minTime)),
        maxTime: Math.max(...kept.map((child) => child.maxTime)),
        count: kept.reduce((sum, child) => sum + child.count, 0),
      };
    return saveNode(node.level, kept);
  };
  const countSequence = async (
    reference: OrderedIndexReference,
    sequence: number,
    cutoff: number,
    expected?: { level: number; extent: Child },
  ): Promise<number> => {
    const node = await checkedNode(reference, expected);
    let count = 0;
    for (const child of node.children) {
      if (child.first.sequence > sequence || child.last.sequence < sequence || child.maxTime < cutoff) continue;
      if (child.first.sequence === child.last.sequence && child.minTime >= cutoff) count += child.count;
      else if (node.level)
        count += await countSequence(child.reference, sequence, cutoff, { level: node.level - 1, extent: child });
      else count++;
    }
    return count;
  };
  const plan = async (
    root: OrderedIndexReference | null,
    options: { sequence: number; index: number; limit: number; newest?: boolean; cutoff: number },
  ) => {
    if (!root) return { rows: [] as LogIndexedMetadata[], more: false };
    const selected = await select(root, options);
    const rows = selected
      .slice(0, options.limit)
      .map((child) => ({ ...child.first, reference: child.reference, metadata: child.metadata! }));
    if (options.newest) rows.reverse();
    return { rows, more: selected.length > options.limit };
  };
  const materialize = async (selected: LogIndexedMetadata[], cutoff: () => number = () => 0) =>
    Promise.all(
      selected
        .filter((row) => Date.parse(row.metadata.createdAt) >= cutoff())
        .map(async (expected) => {
          const row = readEntry(await nodes.read(expected.reference));
          if (compare(row, expected) !== 0) throw new Error("Log payload differs from authenticated page position");
          await readLogPayload(row.entry, { ...expected.metadata, reference: expected.reference });
          await nodes.retain(expected.reference, []);
          return row;
        }),
    );
  return {
    plan,
    materialize,
    count: (root: OrderedIndexReference, sequence: number, cutoff: number) => countSequence(root, sequence, cutoff),
    async append(root: OrderedIndexReference | null, input: LogIndexedEntry[]) {
      const rows = structuredClone(input).map(readEntry);
      if (!rows.length || rows.length > 100) throw new Error("A log index append writes between 1 and 100 entries");
      for (let index = 1; index < rows.length; index++)
        if (compare(rows[index - 1]!, rows[index]!) >= 0) throw new Error("Log entries must be in relay order");
      const old = root
        ? await loadNode(root)
        : { type: "append-log-index" as const, version: 2 as const, level: 0, children: [] };
      if (old.children.length && compare(old.children.at(-1)!.last, rows[0]!) >= 0)
        throw new Error("Log append overlaps its retained prefix");
      const added = await Promise.all(
        rows.map(async (row) => {
          const reference = await nodes.write(row as unknown as Json, []);
          const point = { sequence: row.sequence, index: row.index };
          const time = Date.parse(row.entry.createdAt);
          return {
            reference,
            first: point,
            last: point,
            minTime: time,
            maxTime: time,
            count: 1,
            metadata: {
              id: row.entry.id,
              writerId: row.entry.writerId,
              createdAt: row.entry.createdAt,
              fingerprint: await fingerprint(row.entry as unknown as Json),
            },
          };
        }),
      );
      const expanded = await appendTo(old, added, root ?? undefined);
      if (expanded.length === 1) return expanded[0]!.reference;
      return (await saveNode(old.level + 1, expanded)).reference;
    },
    async read(
      root: OrderedIndexReference | null,
      options: { sequence: number; index: number; limit: number; newest?: boolean; cutoff: number },
    ) {
      const page = await plan(root, options);
      return { rows: await materialize(page.rows, () => options.cutoff), more: page.more };
    },
    async prune(root: OrderedIndexReference | null, cutoff: number) {
      return root ? ((await pruneNode(root, cutoff))?.reference ?? null) : null;
    },
  };
};
