import type { JsonObject, JsonValue } from "./types/json";
import type { WebviewEditingChange } from "./types/webview-editing";

const record = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const diffEditingState = (before: object, after: object, path: string[] = []) => {
  const changes: WebviewEditingChange[] = [];
  if (Object.keys(before).some((key) => !Object.hasOwn(after, key))) return [{ path, value: after as JsonObject }];
  for (const [key, value] of Object.entries(after)) {
    const previous = (before as Record<string, unknown>)[key];
    if (JSON.stringify(previous) === JSON.stringify(value)) continue;
    const nextPath = [...path, key];
    if (previous !== undefined && record(previous) && record(value))
      changes.push(...diffEditingState(previous, value, nextPath));
    else changes.push({ path: nextPath, value: value as JsonValue });
  }
  return changes;
};

export const applyEditingChanges = <State extends object>(state: State, changes: WebviewEditingChange[]) => {
  let next = structuredClone(state) as JsonObject;
  for (const change of changes) {
    if (change.path.some((key) => ["__proto__", "constructor", "prototype"].includes(key)))
      throw new Error("Invalid editing path");
    if (change.path.length === 0) {
      if (!record(change.value)) throw new Error("The editing state root must be an object");
      next = structuredClone(change.value);
      continue;
    }
    let target = next;
    for (const key of change.path.slice(0, -1)) {
      if (target[key] === undefined) target[key] = {};
      if (!record(target[key])) throw new Error("Editing paths must traverse objects");
      target = target[key] as JsonObject;
    }
    target[change.path.at(-1)!] = structuredClone(change.value);
  }
  return next as State;
};

/** Rebase independent drafts, dropping whole drafts whose paths no longer apply. */
export const rebaseEditingChanges = <State extends object, Key>(
  state: State,
  drafts: Map<Key, WebviewEditingChange[]>,
) => {
  let value = state;
  const applicable = new Map<Key, WebviewEditingChange[]>();
  for (const [key, changes] of drafts) {
    try {
      value = applyEditingChanges(value, changes);
      applicable.set(key, changes);
    } catch {
      // A structural edit can remove the object a pending gesture was editing.
    }
  }
  return { value, drafts: applicable };
};
