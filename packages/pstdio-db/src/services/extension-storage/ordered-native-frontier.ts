import type { OrderedTextDependency } from "pstdio-sync/records";
import type { Doc } from "yjs";

const frontier = "ordered-text-frontier";

/** The editor may forward an optimistic root before its record group reaches the relay. */
export const exposeOrderedTextFrontier = (document: Doc, dependencies: OrderedTextDependency[]) => {
  const map = document.getMap<boolean>(frontier);
  for (const dependency of dependencies) {
    const key = JSON.stringify([dependency.operationId, dependency.fingerprint]);
    if (!map.has(key)) map.set(key, true);
  }
};

/** Keep proof in full snapshots and deltas, including a different host's admitted room. */
export const readOrderedTextFrontier = (document: Doc, pending: OrderedTextDependency[]) => {
  const dependencies = new Map(pending.map((item) => [item.operationId, item]));
  for (const [key, enabled] of document.getMap<boolean>(frontier)) {
    const value: unknown = JSON.parse(key);
    if (
      enabled !== true ||
      !Array.isArray(value) ||
      value.length !== 2 ||
      typeof value[0] !== "string" ||
      !value[0] ||
      typeof value[1] !== "string" ||
      !/^[a-f0-9]{64}$/.test(value[1])
    )
      throw new Error("Invalid ordered editor dependency proof");
    const dependency = { operationId: value[0], fingerprint: value[1] };
    const previous = dependencies.get(dependency.operationId);
    if (previous && previous.fingerprint !== dependency.fingerprint)
      throw new Error("Ordered editor dependency identity changed");
    dependencies.set(dependency.operationId, dependency);
  }
  return [...dependencies.values()];
};
