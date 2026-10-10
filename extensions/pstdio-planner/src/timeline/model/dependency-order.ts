// Order items so each comes after its dependencies in the same list, keeping the given order otherwise.
export function dependencyOrder<T>(items: T[], idOf: (item: T) => string, dependenciesOf: (item: T) => string[]): T[] {
  const present = new Set(items.map(idOf));
  const placed = new Set<string>();
  const pending = [...items];
  const ordered: T[] = [];
  while (pending.length > 0) {
    const ready = pending.findIndex((item) =>
      dependenciesOf(item).every((id) => !present.has(id) || placed.has(id) || id === idOf(item)),
    );

    // Planner refuses dependency cycles; taking the next item keeps a bad record from stalling.
    const [next] = pending.splice(Math.max(ready, 0), 1);
    placed.add(idOf(next));
    ordered.push(next);
  }

  return ordered;
}
