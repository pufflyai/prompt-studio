const writes = new Map<string, Promise<unknown>>();

// Rename and autosave update the same Markdown file. Serialize our writes so
// each operation merges the latest title and body instead of overwriting either.
export const writeNoteInOrder = async <T>(id: string, operation: () => Promise<T>) => {
  const pending = (writes.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation);
  writes.set(id, pending);
  try {
    return await pending;
  } finally {
    if (writes.get(id) === pending) writes.delete(id);
  }
};
