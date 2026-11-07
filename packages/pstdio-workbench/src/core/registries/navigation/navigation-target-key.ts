import type { NavigationTarget } from "./navigation-registry";

// Parameter order does not change the action, while array order changes compound navigation.
export const stableNavigationValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableNavigationValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableNavigationValue(item)]),
    );
  }
  return value;
};

export const getNavigationTargetKey = (action: NavigationTarget) => {
  if (
    action.kind === "command" &&
    action.args &&
    typeof action.args === "object" &&
    !Array.isArray(action.args) &&
    Object.keys(action.args).length === 0
  ) {
    const { args: _args, ...target } = action;
    return JSON.stringify(stableNavigationValue(target));
  }
  return JSON.stringify(stableNavigationValue(action));
};
