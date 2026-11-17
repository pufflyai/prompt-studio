import { ClassComponentTag, type Fiber, traverseContexts, traverseProps, traverseState } from "bippy";

const effectDependencies = (value: unknown) => {
  if (
    !value ||
    typeof value !== "object" ||
    !("deps" in value) ||
    !("inst" in value) ||
    !("tag" in value) ||
    !("create" in value) ||
    typeof value.create !== "function"
  )
    return undefined;
  return Array.isArray(value.deps) ? value.deps : null;
};

// Compare values by identity as React does. All values stay within the render callback.
export const detectRenderInputChange = (fiber: Fiber) => {
  const previous = fiber.alternate;
  if (!previous || previous.type !== fiber.type) return "unknown";
  const nextProps = fiber.memoizedProps;
  const previousProps = previous.memoizedProps;
  if (!nextProps || !previousProps || typeof nextProps !== "object" || typeof previousProps !== "object") {
    return "unknown";
  }
  if (
    traverseProps(
      fiber,
      (key, next, prev) =>
        !Object.is(next, prev) || Object.hasOwn(nextProps, key) !== Object.hasOwn(previousProps, key),
    )
  )
    return "changed";
  if (Boolean(fiber.dependencies?.firstContext) !== Boolean(previous.dependencies?.firstContext)) return "changed";
  if (
    traverseContexts(
      fiber,
      (next, prev) => next?.context !== prev?.context || !Object.is(next?.memoizedValue, prev?.memoizedValue),
    )
  )
    return "changed";
  if (fiber.tag === ClassComponentTag) {
    return Object.is(fiber.memoizedState, previous.memoizedState) ? "unchanged" : "changed";
  }
  let unknown = false;
  const hookChanged = traverseState(fiber, (next, prev) => {
    if (!next || !prev) {
      unknown = true;
      return false;
    }
    const value = next.memoizedState;
    const before = prev.memoizedState;
    if (Object.is(value, before)) return false;
    if (next.queue && prev.queue) return true;
    const nextDeps = effectDependencies(value);
    const prevDeps = effectDependencies(before);
    // Effect records are recreated even when the effect's inputs stay the same.
    if (nextDeps && prevDeps) {
      return nextDeps.length !== prevDeps.length || nextDeps.some((dep, i) => !Object.is(dep, prevDeps[i]));
    }
    unknown = true;
    return false;
  });
  if (hookChanged) return "changed";
  return unknown ? "unknown" : "unchanged";
};
