export interface StateChange {
  path: string[];
  value: unknown;
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const stateChanges = (before: object, after: object, path: string[] = []): StateChange[] =>
  Object.entries(after).flatMap(([key, value]) => {
    const previous = (before as Record<string, unknown>)[key];
    if (Object.is(previous, value)) return [];
    const nextPath = [...path, key];
    if (record(previous) && record(value)) return stateChanges(previous, value, nextPath);
    return [{ path: nextPath, value }];
  });

export const applyStateChanges = <State extends object>(state: State, changes: StateChange[]): State => {
  const next = structuredClone(state);
  for (const change of changes) {
    let target = next as Record<string, unknown>;
    if (!change.path.length || change.path.some((key) => ["__proto__", "constructor", "prototype"].includes(key)))
      throw new Error("Invalid state path");
    for (const key of change.path.slice(0, -1)) {
      if (!record(target[key])) target[key] = {};
      target = target[key] as Record<string, unknown>;
    }
    target[change.path.at(-1)!] = change.value;
  }
  return next;
};
