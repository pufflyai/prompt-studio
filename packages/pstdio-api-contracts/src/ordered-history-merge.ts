export interface OrderedHistoryMerge<T> {
  key: (item: T) => string;
  merge: (known: T, native: T) => T;
  refineKey?: (known: T[], native: T[]) => (item: T) => string;
  // When an item was recorded, so native items newer than the saved end can be told apart.
  time?: (item: T) => number | undefined;
  // Whether the saved side already shows a native item's content.
  covered?: (item: T) => boolean;
}

const positions = <T>(items: T[], key: (item: T) => string) => {
  const result = new Map<string, number[]>();
  items.forEach((item, index) => {
    const value = key(item);
    const indices = result.get(value) ?? [];
    indices.push(index);
    result.set(value, indices);
  });
  return result;
};

// Keep the largest set of anchors that both sides order the same way.
const orderedAnchors = (anchors: [number, number][]) => {
  const tails: number[] = [];
  const previous: number[] = [];
  anchors.forEach(([, native], index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (anchors[tails[middle]][1] < native) low = middle + 1;
      else high = middle;
    }
    previous[index] = low > 0 ? tails[low - 1] : -1;
    tails[low] = index;
  });
  const kept: [number, number][] = [];
  for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index]) kept.unshift(anchors[index]);
  return kept;
};

const newerThanSaved = <T>(known: T[], native: T[], options: OrderedHistoryMerge<T>) => {
  const times = options.time ? known.map(options.time).filter((value) => value !== undefined) : [];
  if (!times.length) return [];
  const savedUntil = Math.max(...times);
  return native.filter((item) => (options.time?.(item) ?? savedUntil) > savedUntil);
};

// The saved side is what the user saw, so it wins wherever both sides record the same
// span differently. Native history adds what the saved side lacks: unmatched gaps and
// messages written after the saved side ends. Unique ordered anchors place those gaps.
export const mergeOrderedHistory = <T>(
  known: T[],
  native: T[],
  options: OrderedHistoryMerge<T>,
  trailing = true,
): T[] => {
  const { key, merge, refineKey, covered } = options;
  const missing = native.filter((item) => !covered?.(item));
  if (!known.length) return missing;
  if (!native.length) return known;
  const knownPositions = positions(known, key);
  const nativePositions = positions(native, key);
  const found: [number, number][] = [];
  for (const [value, indices] of knownPositions) {
    const other = nativePositions.get(value);
    if (indices.length === 1 && other?.length === 1) found.push([indices[0], other[0]]);
  }
  const anchors = orderedAnchors(found.sort((a, b) => a[0] - b[0]));
  if (!anchors.length) {
    if (refineKey)
      return mergeOrderedHistory(
        known,
        native,
        { ...options, key: refineKey(known, native), refineKey: undefined },
        trailing,
      );
    // A run cut short leaves one side a prefix of the other, so equal keys pair in order.
    const paired = Math.min(known.length, native.length);
    if (known.slice(0, paired).every((item, index) => key(item) === key(native[index]))) {
      return [
        ...known.slice(0, paired).map((item, index) => merge(item, native[index])),
        ...known.slice(paired),
        ...native.slice(paired),
      ];
    }
    return trailing ? [...known, ...newerThanSaved(known, missing, options)] : known;
  }
  // An anchor dropped for its order still names a message the saved side already has.
  const kept = new Set(anchors.map(([, index]) => index));
  const reordered = new Set(found.filter(([, index]) => !kept.has(index)).map(([, index]) => native[index]));
  const nativeSpan = (start: number, end?: number) => native.slice(start, end).filter((item) => !reordered.has(item));
  let left = 0;
  let right = 0;
  const result: T[] = [];
  for (const [a, b] of anchors) {
    result.push(...mergeOrderedHistory(known.slice(left, a), nativeSpan(right, b), options, false));
    result.push(merge(known[a], native[b]));
    left = a + 1;
    right = b + 1;
  }
  result.push(...mergeOrderedHistory(known.slice(left), nativeSpan(right), options, trailing));
  return result;
};
