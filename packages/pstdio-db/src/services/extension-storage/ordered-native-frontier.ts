import type { OrderedTextDependency } from "pstdio-sync/records";
import { textDocumentKeys } from "pstdio-sync/text";
import type { Doc } from "yjs";

const frontier = textDocumentKeys.orderedFrontier;

/** The editor may forward an optimistic root before its record group reaches the relay. */
export const exposeOrderedTextFrontier = (document: Doc, dependencies: OrderedTextDependency[]) => {
  const map = document.getMap<boolean>(frontier);
  for (const dependency of dependencies) {
    const key = JSON.stringify([dependency.operationId, dependency.fingerprint]);
    if (map.has(key)) continue;
    // The same inherited proof must have the same structs on every snapshot.
    // Keep this host author above the ordinary editor's uint32 client space.
    const author = document.clientID;
    document.clientID = Number.parseInt(dependency.fingerprint.slice(0, 13), 16) + 0x1_0000_0000;
    try {
      map.set(key, true);
    } finally {
      document.clientID = author;
    }
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
