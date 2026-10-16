import type { LocalOperation } from "./types";

export const orderOperations = (available: ReadonlyMap<string, LocalOperation>, ids: Iterable<string>) => {
  const remaining = new Set(ids);
  const ordered: LocalOperation[] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((id) => available.get(id)!.parents.every((parent) => !remaining.has(parent)));
    if (!ready.length) throw new Error("Cyclic operation dependency");
    for (const id of ready) {
      ordered.push(available.get(id)!);
      remaining.delete(id);
    }
  }
  return ordered;
};
