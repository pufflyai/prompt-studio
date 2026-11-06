import type { OrderedIndexReference } from "./ordered-receipt-index-blobs";
import {
  groupReceiptEntries,
  mergeReceiptEntries,
  type ReceiptIndexBranch,
  type ReceiptIndexEntry,
  type ReceiptIndexNode,
  receiptLeafEntries,
} from "./ordered-receipt-index-pages";

type Children = ReceiptIndexBranch["children"];
interface Visit {
  type: "visit";
  reference: OrderedIndexReference | null;
  entries: ReceiptIndexEntry[];
  prefix: string;
  save: (reference: OrderedIndexReference) => void;
}
interface Finish {
  type: "finish";
  reference: OrderedIndexReference | null;
  prefix: string;
  original: Children;
  children: Children;
  save: Visit["save"];
}
export const createReceiptTreeWriter = (nodes: {
  read: (reference: OrderedIndexReference, prefix: string) => Promise<ReceiptIndexNode>;
  write: (node: ReceiptIndexNode) => Promise<OrderedIndexReference>;
}) => {
  const planChildren = (tasks: (Visit | Finish)[], task: Visit, original: Children, entries: ReceiptIndexEntry[]) => {
    const children = { ...original };
    tasks.push({ type: "finish", reference: task.reference, prefix: task.prefix, original, children, save: task.save });
    for (const [digit, group] of groupReceiptEntries(entries, task.prefix.length))
      tasks.push({
        type: "visit",
        reference: original[digit] ?? null,
        entries: group,
        prefix: task.prefix + digit,
        save: (reference) => {
          children[digit] = reference;
        },
      });
  };
  const visit = async (tasks: (Visit | Finish)[], task: Visit) => {
    const node = task.reference ? await nodes.read(task.reference, task.prefix) : undefined;
    if (node?.type === "branch") return planChildren(tasks, task, node.children, task.entries);
    const merged = mergeReceiptEntries(node?.entries ?? [], task.entries);
    if (!merged.changed && task.reference) return task.save(task.reference);
    if (merged.entries.length <= receiptLeafEntries) {
      task.save(
        await nodes.write({
          version: 1,
          format: "ordered-receipts",
          type: "leaf",
          prefix: task.prefix,
          entries: merged.entries,
        }),
      );
      return;
    }
    if (task.prefix.length >= 64) throw new Error("Receipt index hash collision");
    planChildren(tasks, { ...task, reference: null }, {}, merged.entries);
  };
  const finish = async (task: Finish) => {
    const entries = Object.entries(task.children);
    const same =
      entries.length === Object.keys(task.original).length &&
      entries.every(
        ([key, reference]) =>
          reference.blobId === task.original[key]?.blobId && reference.byteLength === task.original[key]?.byteLength,
      );
    if (same && task.reference) return task.save(task.reference);
    task.save(
      await nodes.write({
        version: 1,
        format: "ordered-receipts",
        type: "branch",
        prefix: task.prefix,
        children: task.children,
      }),
    );
  };
  return async (root: OrderedIndexReference | null, entries: ReceiptIndexEntry[], prefix = "") => {
    let result: OrderedIndexReference | undefined;
    const tasks: (Visit | Finish)[] = [
      {
        type: "visit",
        reference: root,
        entries,
        prefix,
        save: (reference) => {
          result = reference;
        },
      },
    ];
    while (tasks.length) {
      const task = tasks.pop()!;
      if (task.type === "visit") await visit(tasks, task);
      else await finish(task);
    }
    return result!;
  };
};
