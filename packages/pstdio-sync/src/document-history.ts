import * as Y from "yjs";

type ClockRange = [client: number, clock: number, length: number, deleted: boolean];
const ranges = (items: ClockRange[]) => {
  const merged: ClockRange[] = [];
  for (const item of items.sort(([a, b], [c, d]) => a - c || b - d)) {
    const previous = merged.at(-1);
    if (previous && previous[0] === item[0] && previous[1] + previous[2] === item[1] && previous[3] === item[3])
      previous[2] += item[2];
    else merged.push([...item]);
  }
  return JSON.stringify(merged);
};

/** A field's CRDT identities, including tombstones, without unrelated owner history. */
export const documentHistory = (document: Y.Doc) => {
  const decoded = Y.decodeUpdate(Y.encodeStateAsUpdate(document));
  const clients = new Map<number, typeof decoded.structs>();
  for (const struct of decoded.structs) {
    const items = clients.get(struct.id.client) ?? [];
    items.push(struct);
    clients.set(struct.id.client, items);
  }
  const itemAt = (id: { client: number; clock: number }) => {
    const items = clients.get(id.client) ?? [];
    let low = 0;
    let high = items.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (items[middle].id.clock + items[middle].length <= id.clock) low = middle + 1;
      else high = middle;
    }
    return items[low];
  };
  const addresses = new Map<Y.Item, { parent: string; key: string | null } | undefined>();
  const address = (item: Y.Item) => {
    const chain: Y.Item[] = [];
    let current: Y.Item | undefined = item;
    let result: { parent: string; key: string | null } | undefined;
    while (current) {
      if (addresses.has(current)) {
        result = addresses.get(current);
        break;
      }
      chain.push(current);
      if (typeof current.parent === "string") {
        result = { parent: current.parent, key: current.parentSub };
        break;
      }
      const origin: Y.ID | null = current.origin ?? current.rightOrigin;
      const previous: (typeof decoded.structs)[number] | null = origin && itemAt(origin);
      current = previous instanceof Y.Item ? previous : undefined;
    }
    for (const entry of chain) addresses.set(entry, result);
    return result;
  };
  const fieldRanges = new Map<string, ClockRange[]>();
  for (const item of decoded.structs) {
    if (!(item instanceof Y.Item)) continue;
    const field = address(item);
    if (!field || field.key === null) continue;
    const key = JSON.stringify([field.parent, field.key]);
    const entries = fieldRanges.get(key) ?? [];
    entries.push([item.id.client, item.id.clock, item.length, Y.isDeleted(decoded.ds, item.id)]);
    fieldRanges.set(key, entries);
  }
  const fields = new Map([...fieldRanges].map(([key, entries]) => [key, ranges(entries)]));
  const sequences = new Map(
    [...document.share].map(([name, type]) => [
      name,
      ranges(Y.getTypeChildren(type).map((item) => [item.id.client, item.id.clock, item.length, item.deleted])),
    ]),
  );
  return { fields, sequences };
};
export type DocumentHistory = ReturnType<typeof documentHistory>;
