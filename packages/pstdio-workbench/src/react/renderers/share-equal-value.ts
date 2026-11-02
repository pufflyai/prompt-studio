import { useState } from "react";

const isPlainData = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  // Provider metadata and accessors are opaque; sharing them could discard an update.
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return typeof key === "string" && descriptor.enumerable && "value" in descriptor;
  });
};

const hasId = (value: unknown): value is { id: string } => isPlainData(value) && typeof value.id === "string";

// Equal parts move into the loaded value in place: views, and lookups keyed by the loaded objects, keep finding
// each changed object as it was loaded. Frozen values and accessor properties stay as loaded.
const replaceInPlace = (target: object, key: string | number, value: unknown) => {
  if (Object.isFrozen(target)) return;
  if (Object.getOwnPropertyDescriptor(target, key)?.writable) (target as Record<string | number, unknown>)[key] = value;
};

/**
 * Returns `previous` when `next` equals it. Otherwise returns `next` itself, with every part that equals the
 * matching part of `previous` replaced, in place, by that part. A reload that changed nothing gives back the value
 * on screen, so views showing it do not render again; when one row changes, the other rows keep their objects and
 * the changed row stays the object that was loaded. Only arrays and plain objects are compared.
 */
export const shareEqualValue = <T>(previous: unknown, next: T): T => {
  const active = new WeakSet<object>();
  const cycle = Symbol("cyclic value");
  try {
    return shareValue(previous, next, active, cycle);
  } catch (error) {
    // Keep the loaded graph and its backreferences intact when it contains a cycle.
    if (error === cycle) return next;
    throw error;
  }
};

const shareValue = <T>(previous: unknown, next: T, active: WeakSet<object>, cycle: symbol): T => {
  if (Object.is(previous, next) || !next || typeof next !== "object") return next;
  if (active.has(next)) throw cycle;
  active.add(next);
  try {
    return shareParts(previous, next, active, cycle);
  } finally {
    active.delete(next);
  }
};

const shareParts = <T>(previous: unknown, next: T, active: WeakSet<object>, cycle: symbol): T => {
  if (Array.isArray(previous) && Array.isArray(next)) {
    // Rows with ids are matched by id, so a moved row keeps its object; other items by position.
    const byId =
      previous.every(hasId) && next.every(hasId) ? new Map(previous.map((item) => [item.id, item])) : undefined;
    const shared = next.map((item, index) =>
      shareValue(byId ? byId.get(item.id) : previous[index], item, active, cycle),
    );
    if (shared.length === previous.length && shared.every((item, index) => item === previous[index])) {
      return previous as T;
    }
    shared.forEach((item, index) => {
      if (item !== next[index]) replaceInPlace(next, index, item);
    });
    return next;
  }
  if (isPlainData(previous) && isPlainData(next)) {
    if (Object.getPrototypeOf(previous) !== Object.getPrototypeOf(next)) return next;
    const keys = Object.keys(next);
    const shared = keys.map((key) => [key, shareValue(previous[key], next[key], active, cycle)] as const);
    const same =
      keys.length === Object.keys(previous).length &&
      shared.every(([key, value]) => Object.hasOwn(previous, key) && value === previous[key]);
    if (same) return previous as T;
    for (const [key, value] of shared) if (value !== next[key]) replaceInPlace(next, key, value);
    return next;
  }
  return next;
};

/**
 * Returns `value`, sharing every part that equals the value this hook returned last for the same `scope` (see
 * `shareEqualValue`), so a component whose sources return new but equal objects passes the same objects on.
 * A `scope` with any different item starts over: objects from another query or registration can carry another
 * source. React Compiler treats a hook
 * result as unchanging, so it can cache what is built from it. Parts that are not plain data, such as functions,
 * must keep their identity between renders, or every render would store a new value.
 */
export const useSharedEqualValue = <T>(value: T, scope: readonly unknown[]): T => {
  const [shown, setShown] = useState({ scope, value });
  const sameScope =
    shown.scope.length === scope.length && shown.scope.every((item, index) => Object.is(item, scope[index]));
  const shared = sameScope ? shareEqualValue(shown.value, value) : value;
  if (!sameScope || shared !== shown.value) setShown({ scope, value: shared });
  return shared;
};
