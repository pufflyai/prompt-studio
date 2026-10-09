const writes = new Map<string, Promise<unknown>>();

// Serialize writes to one note or one project's folder names, so each operation
// validates and merges the latest saved state.
export const writeResourceInOrder = async <T>(id: string, operation: () => Promise<T>) => {
  const pending = (writes.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation);
  writes.set(id, pending);
  try {
    return await pending;
  } finally {
    if (writes.get(id) === pending) writes.delete(id);
  }
};
