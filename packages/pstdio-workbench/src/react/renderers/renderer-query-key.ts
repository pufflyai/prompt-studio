/** Object insertion order is not part of a saved view's query; array order is. */
export const rendererQueryKey = (value: unknown) =>
  JSON.stringify(value, (_key, entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    return Object.fromEntries(
      Object.keys(entry)
        .sort()
        .map((key) => [key, entry[key]]),
    );
  });
