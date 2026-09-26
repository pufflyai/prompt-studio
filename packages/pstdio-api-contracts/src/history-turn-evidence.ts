// Evidence must identify one occurrence on both sides. Common replies such as
// "Done" cannot identify a repeated prompt by themselves.
export const historyTurnEvidence = <T>(
  known: T[],
  native: T[],
  prompt: (turn: T) => string,
  body: (turn: T) => string[],
) => {
  const signatures = (turn: T) => JSON.stringify([prompt(turn), body(turn)]);
  if (known.length === native.length && known.every((turn, index) => signatures(turn) === signatures(native[index]))) {
    return signatures;
  }
  const tokens = (turns: T[]) => {
    const positions = new Map<string, number>();
    turns.forEach((turn, index) => {
      for (const value of new Set(body(turn))) {
        const token = JSON.stringify([prompt(turn), value]);
        positions.set(token, positions.has(token) ? -1 : index);
      }
    });
    return positions;
  };
  const left = tokens(known);
  const right = tokens(native);
  const matches = new Map<number, Set<number>>();
  const reverse = new Map<number, Set<number>>();
  for (const [token, index] of left) {
    const other = right.get(token);
    if (index < 0 || other === undefined || other < 0) continue;
    const targets = matches.get(index) ?? new Set<number>();
    targets.add(other);
    matches.set(index, targets);
    const sources = reverse.get(other) ?? new Set<number>();
    sources.add(index);
    reverse.set(other, sources);
  }
  const keys = new Map<T, string>();
  known.forEach((turn, index) => {
    keys.set(turn, `known:${index}`);
  });
  native.forEach((turn, index) => {
    keys.set(turn, `native:${index}`);
  });
  for (const [index, targets] of matches) {
    if (targets.size !== 1) continue;
    const other = [...targets][0];
    if (reverse.get(other)?.size !== 1) continue;
    const key = `pair:${index}:${other}`;
    keys.set(known[index], key);
    keys.set(native[other], key);
  }
  return (turn: T) => keys.get(turn)!;
};
