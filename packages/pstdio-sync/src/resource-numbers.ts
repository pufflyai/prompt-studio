import type * as Y from "yjs";

export const resourceNumbersDocumentId = "resource-identities";
export const coreOwnerId = "pstdio";

export interface NumberedResource {
  id: string;
  extensionId: string;
  kind: string;
  prefix: string;
  value: number;
}

export const resourceNumbers = (document: Y.Doc) => document.getMap<NumberedResource>("resource-numbers");
const history = (document: Y.Doc) => document.getMap<true>("resource-number-history");
export const resourceShorthand = (resource: NumberedResource) => `${resource.prefix}-${resource.value}`;
export const rememberResourceNumber = (document: Y.Doc, resource: NumberedResource) => {
  history(document).set(JSON.stringify([resource.id, resourceShorthand(resource)]), true);
};
export const resourceIdentity = (document: Y.Doc, resource: NumberedResource) => {
  const shorthand = resourceShorthand(resource);
  const aliases = [...history(document).keys()]
    .map((key) => JSON.parse(key) as [string, string])
    .filter(([id, alias]) => id === resource.id && alias !== shorthand)
    .map(([, alias]) => alias)
    .sort();
  return { id: resource.id, kind: resource.kind, shorthand, aliases };
};
export const nextResourceNumber = (document: Y.Doc, prefix: string, floor = 0) => {
  let maximum = floor;
  for (const resource of resourceNumbers(document).values())
    if (resource.prefix === prefix) maximum = Math.max(maximum, resource.value);
  for (const key of history(document).keys()) {
    const [, shorthand] = JSON.parse(key) as [string, string];
    if (shorthand.startsWith(`${prefix}-`)) maximum = Math.max(maximum, Number(shorthand.slice(prefix.length + 1)));
  }
  return maximum + 1;
};

/** IDs decide collisions; clocks never decide who keeps a number. */
export const reconcileResourceNumbers = (document: Y.Doc) => {
  const resources = resourceNumbers(document);
  const occupied = new Set<string>();
  const changes: { resource: NumberedResource; previousShorthand: string; shorthand: string }[] = [];
  document.transact(() => {
    for (const resource of [...resources.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const key = JSON.stringify([resource.extensionId, resource.kind, resource.value]);
      if (!occupied.has(key)) {
        occupied.add(key);
        continue;
      }
      const next = { ...resource, value: nextResourceNumber(document, resource.prefix) };
      rememberResourceNumber(document, resource);
      rememberResourceNumber(document, next);
      resources.set(resource.id, next);
      occupied.add(JSON.stringify([next.extensionId, next.kind, next.value]));
      changes.push({
        resource: next,
        previousShorthand: resourceShorthand(resource),
        shorthand: resourceShorthand(next),
      });
    }
  });
  return changes;
};
