import type { PersonalIndexDelta } from "./personal-history-index";

export const personalIndexKey = (delta: PersonalIndexDelta) => JSON.stringify([delta.kind, delta.deviceId, delta.id]);

/** Keep repeated changes to one row sequential and bound SQL pages by rows and encoded size. */
export function* personalIndexPages<T extends { delta: PersonalIndexDelta }>(changes: T[]) {
  let page: T[] = [];
  let ids = new Set<string>();
  let bytes = 0;
  for (const change of changes) {
    const id = personalIndexKey(change.delta);
    const size = Buffer.byteLength(JSON.stringify(change));
    if (page.length && (page.length === 100 || ids.has(id) || bytes + size > 4_000_000)) {
      yield page;
      page = [];
      ids = new Set();
      bytes = 0;
    }
    page.push(change);
    ids.add(id);
    bytes += size;
  }
  if (page.length) yield page;
}
