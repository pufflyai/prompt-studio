import type { OrderedIndexReference } from "./ordered-receipt-index-blobs";
import {
  type ReceiptIndexBranch,
  type ReceiptIndexEntry,
  type ReceiptIndexNode,
  type ReceiptIndexValue,
  sameReceiptIndexValue,
} from "./ordered-receipt-index-pages";

type Reference = OrderedIndexReference | null;
type Children = ReceiptIndexBranch["children"];
interface Visit {
  type: "visit";
  preferred: Reference;
  retained: Reference;
  prefix: string;
  save: (reference: Reference) => void;
}
interface Finish {
  type: "finish";
  preferred: OrderedIndexReference;
  node: ReceiptIndexBranch;
  children: Children;
  save: Visit["save"];
}
const preferredValue = (preferred: ReceiptIndexValue, retained: ReceiptIndexValue) => {
  if (preferred.type === "identity" && retained.type === "identity") {
    if (preferred.fingerprint !== retained.fingerprint)
      throw new Error("Operation identity reused with changed payload");
    return preferred;
  }
  if (
    preferred.type === "receipt" &&
    retained.type === "receipt" &&
    preferred.receipt.decision.fingerprint !== retained.receipt.decision.fingerprint
  )
    throw new Error("Operation identity reused with changed payload");
  if (!sameReceiptIndexValue(preferred, retained)) throw new Error("An ordered receipt is immutable");
  return preferred;
};
const addedLeafEntries = (preferred: ReceiptIndexEntry[], retained: ReceiptIndexEntry[]) => {
  const existing = new Map(preferred.map((entry) => [entry.key, entry.value]));
  const added: ReceiptIndexEntry[] = [];
  for (const entry of retained) {
    const before = existing.get(entry.key);
    if (before) preferredValue(before, entry.value);
    else added.push(entry);
  }
  return added;
};

export const createReceiptTreeMerger = (nodes: {
  read: (reference: OrderedIndexReference, prefix: string) => Promise<ReceiptIndexNode>;
  write: (node: ReceiptIndexNode) => Promise<OrderedIndexReference>;
  lookup: (reference: Reference, key: string, prefix: string) => Promise<ReceiptIndexValue | undefined>;
  update: (reference: Reference, entries: ReceiptIndexEntry[], prefix: string) => Promise<OrderedIndexReference>;
}) => {
  const mergeLeaf = async (task: Visit, preferred: ReceiptIndexNode, retained: ReceiptIndexNode) => {
    if (preferred.type === "leaf" && retained.type === "leaf") {
      const added = addedLeafEntries(preferred.entries, retained.entries);
      return added.length ? nodes.update(task.preferred, added, task.prefix) : task.preferred!;
    }
    const incomingPreferred = preferred.type === "leaf";
    const entries = incomingPreferred
      ? preferred.entries
      : (retained as Extract<ReceiptIndexNode, { type: "leaf" }>).entries;
    const base = incomingPreferred ? task.retained : task.preferred;
    const merged: ReceiptIndexEntry[] = [];
    for (const entry of entries) {
      const previous = await nodes.lookup(base, entry.key, task.prefix);
      let value = entry.value;
      if (previous)
        value = incomingPreferred ? preferredValue(entry.value, previous) : preferredValue(previous, entry.value);
      merged.push({ key: entry.key, value });
    }
    return nodes.update(base, merged, task.prefix);
  };
  const planChildren = (
    tasks: (Visit | Finish)[],
    task: Visit,
    preferred: ReceiptIndexBranch,
    retained: ReceiptIndexBranch,
  ) => {
    const children = { ...preferred.children };
    tasks.push({ type: "finish", preferred: task.preferred!, node: preferred, children, save: task.save });
    for (const [digit, reference] of Object.entries(retained.children))
      tasks.push({
        type: "visit",
        preferred: preferred.children[digit] ?? null,
        retained: reference,
        prefix: task.prefix + digit,
        save: (reference) => {
          children[digit] = reference!;
        },
      });
  };
  const visit = async (tasks: (Visit | Finish)[], task: Visit) => {
    if (!task.preferred || !task.retained) {
      const reference = task.preferred ?? task.retained;
      if (reference) await nodes.read(reference, task.prefix);
      task.save(reference);
      return;
    }
    if (task.preferred.blobId === task.retained.blobId) {
      if (task.preferred.byteLength !== task.retained.byteLength)
        throw new Error("Receipt root authenticated extent differs");
      if (!task.prefix) await nodes.read(task.preferred, task.prefix);
      task.save(task.preferred);
      return;
    }
    const preferred = await nodes.read(task.preferred, task.prefix);
    const retained = await nodes.read(task.retained, task.prefix);
    if (preferred.type === "branch" && retained.type === "branch")
      return planChildren(tasks, task, preferred, retained);
    task.save(await mergeLeaf(task, preferred, retained));
  };
  const finish = async (task: Finish) => {
    const entries = Object.entries(task.children);
    const same =
      entries.length === Object.keys(task.node.children).length &&
      entries.every(
        ([digit, ref]) =>
          ref.blobId === task.node.children[digit]?.blobId && ref.byteLength === task.node.children[digit]?.byteLength,
      );
    task.save(same ? task.preferred : await nodes.write({ ...task.node, children: task.children }));
  };
  return async (preferred: Reference, retained: Reference) => {
    const result: { reference: Reference } = { reference: null };
    const tasks: (Visit | Finish)[] = [
      {
        type: "visit",
        preferred,
        retained,
        prefix: "",
        save: (reference) => {
          result.reference = reference;
        },
      },
    ];
    while (tasks.length) {
      const task = tasks.pop()!;
      if (task.type === "visit") await visit(tasks, task);
      else await finish(task);
    }
    return result.reference;
  };
};
