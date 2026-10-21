interface Deadline<T> {
  value: T;
  at: number;
  index: number;
}

// An indexed heap keeps one deadline per idle owner. Renewing or retaining an
// owner removes its old deadline instead of accumulating stale timer entries.
export const createSessionResourceDeadlines = <T>() => {
  const heap: Deadline<T>[] = [];
  const entries = new Map<T, Deadline<T>>();
  const swap = (left: number, right: number) => {
    [heap[left], heap[right]] = [heap[right], heap[left]];
    heap[left].index = left;
    heap[right].index = right;
  };
  const up = (entry: Deadline<T>) => {
    while (entry.index > 0) {
      const parent = Math.floor((entry.index - 1) / 2);
      if (heap[parent].at <= entry.at) break;
      swap(entry.index, parent);
    }
  };
  const down = (entry: Deadline<T>) => {
    while (true) {
      const left = entry.index * 2 + 1;
      const right = left + 1;
      let first = entry.index;
      if (left < heap.length && heap[left].at < heap[first].at) first = left;
      if (right < heap.length && heap[right].at < heap[first].at) first = right;
      if (first === entry.index) return;
      swap(entry.index, first);
    }
  };
  return {
    first: () => heap[0],
    set(value: T, at: number) {
      const existing = entries.get(value);
      if (existing) {
        if (existing.at === at) return;
        existing.at = at;
        up(existing);
        down(existing);
        return;
      }
      const entry = { value, at, index: heap.length };
      entries.set(value, entry);
      heap.push(entry);
      up(entry);
    },
    delete(value: T) {
      const entry = entries.get(value);
      if (!entry) return;
      entries.delete(value);
      const last = heap.pop()!;
      if (last === entry) return;
      heap[entry.index] = last;
      last.index = entry.index;
      up(last);
      down(last);
    },
  };
};
