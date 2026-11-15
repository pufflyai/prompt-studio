/** Required preference writes belong to the runtime client, so destroying a guest cannot drop its queue. */
const owners = new WeakMap<object, Map<string, Promise<unknown>>>();
export const persistWebviewPreference = (owner: object, identity: unknown, write: () => Promise<unknown>) => {
  let entries = owners.get(owner);
  if (!entries) {
    entries = new Map();
    owners.set(owner, entries);
  }
  const key = JSON.stringify(identity);
  const previous = entries.get(key);
  const pending = previous ? previous.catch(() => {}).then(write) : write();
  entries.set(key, pending);
  const captured = entries;
  void pending
    .finally(() => {
      if (captured.get(key) === pending) captured.delete(key);
    })
    .catch(() => {});
  return pending;
};
