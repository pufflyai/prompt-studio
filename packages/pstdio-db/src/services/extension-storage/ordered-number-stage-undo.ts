/** Remember only touched entries; staged repair rollback never clones the entire owner per group. */
export const stageMapUndo = <Key, Value>(source: Map<Key, Value>, copy: (value: Value) => Value = (value) => value) => {
  const before = new Map<Key, Value | undefined>();
  return {
    remember(key: Key) {
      if (before.has(key)) return;
      const value = source.get(key);
      before.set(key, value === undefined ? undefined : copy(value));
    },
    restore() {
      for (const [key, value] of before) {
        if (value === undefined) source.delete(key);
        else source.set(key, value);
      }
    },
  };
};
