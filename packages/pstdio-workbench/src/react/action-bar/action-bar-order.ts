import type { WorkbenchCore } from "../../core";

interface IdentifiedItem {
  id: string;
}

export type ActionBarDropEdge = "before" | "after";

export const applyActionBarOrder = <T extends IdentifiedItem>(items: readonly T[], order: readonly string[]) => {
  const remaining = new Map(items.map((item) => [item.id, item]));
  const ordered = order.flatMap((id) => {
    const item = remaining.get(id);
    remaining.delete(id);
    return item ? [item] : [];
  });
  return [...ordered, ...remaining.values()];
};

export const createActionBarOrder = (preferences: WorkbenchCore["preferences"], projectId: string, viewId: string) => {
  const owner = "workbench.action-bar";
  const scope = { scope: "user" as const, scopeId: JSON.stringify([projectId, viewId]) };
  const read = () => {
    const value = preferences.getOwnedValue(owner, "order", scope);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  };

  return {
    read,
    move(items: readonly IdentifiedItem[], id: string, targetId: string, edge: ActionBarDropEdge) {
      const current = new Set(items.map((item) => item.id));
      if (id === targetId || !current.has(id) || !current.has(targetId)) return;
      const order = [...new Set([...read(), ...current])];
      const visible = order.filter((id) => current.has(id));
      const next = visible.filter((entry) => entry !== id);
      next.splice(next.indexOf(targetId) + Number(edge === "after"), 0, id);
      if (next.every((entry, index) => entry === visible[index])) return;

      // A resource can temporarily omit tools. Keep their places when moving the current tools.
      let index = 0;
      const updated = order.map((entry) => (current.has(entry) ? next[index++]! : entry));
      return preferences.setOwnedValue(owner, "order", updated, scope);
    },
  };
};
