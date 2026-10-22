import * as Y from "yjs";

type Range = { clock: number; len: number };
const rangesCover = (available: Range[], wanted: Range[]) =>
  wanted.every((range) => {
    let clock = range.clock;
    const end = clock + range.len;
    for (const other of available) {
      if (other.clock > clock) return false;
      clock = Math.max(clock, other.clock + other.len);
      if (clock >= end) return true;
    }
    return false;
  });
const structRanges = (structs: ReturnType<typeof Y.decodeUpdate>["structs"]) => {
  const clients = new Map<number, Range[]>();
  for (const struct of structs) {
    if (struct instanceof Y.Skip) continue;
    const ranges = clients.get(struct.id.client) ?? [];
    ranges.push({ clock: struct.id.clock, len: struct.length });
    clients.set(struct.id.client, ranges);
  }
  return clients;
};

/** Compare causal identities and tombstones, including bytes Yjs cannot apply yet. */
export const binaryContains = (target: Uint8Array, source: Uint8Array) => {
  const wanted = Y.decodeUpdate(source);
  const available = Y.decodeUpdate(target);
  const structs = structRanges(available.structs);
  for (const [client, ranges] of structRanges(wanted.structs))
    if (!rangesCover(structs.get(client) ?? [], ranges)) return false;
  for (const [client, ranges] of wanted.ds.clients)
    if (!rangesCover(available.ds.clients.get(client) ?? [], ranges)) return false;
  return true;
};

export const binaryIsComplete = (updates: Uint8Array[], document: Y.Doc) => {
  const vector = Y.decodeStateVector(Y.encodeStateVector(document));
  return updates.every((update) => {
    const decoded = Y.decodeUpdate(update);
    for (const struct of decoded.structs)
      if (!(struct instanceof Y.Skip) && struct.id.clock + struct.length > (vector.get(struct.id.client) ?? 0))
        return false;
    for (const [client, ranges] of decoded.ds.clients)
      if (ranges.some(({ clock, len }) => clock + len > (vector.get(client) ?? 0))) return false;
    return true;
  });
};
