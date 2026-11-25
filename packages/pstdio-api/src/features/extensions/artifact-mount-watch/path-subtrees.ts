import { dirname } from "node:path";

export function* pathAndAncestors(path: string) {
  for (let ancestor = path; ancestor !== dirname(ancestor); ancestor = dirname(ancestor)) yield ancestor;
}

export const createPathSubtrees = () => {
  const subtrees = new Map<string, Set<string>>();

  const record = (path: string, from = path) => {
    for (const ancestor of pathAndAncestors(from)) {
      const subtree = subtrees.get(ancestor) ?? new Set<string>();
      subtree.add(path);
      subtrees.set(ancestor, subtree);
    }
  };

  const forget = (path: string, from = path) => {
    for (const ancestor of pathAndAncestors(from)) {
      const subtree = subtrees.get(ancestor);
      subtree?.delete(path);
      if (subtree?.size === 0) subtrees.delete(ancestor);
    }
  };

  return { record, forget, under: (path: string) => subtrees.get(path) };
};
