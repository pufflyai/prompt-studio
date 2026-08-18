const hunkPattern = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/gm;

export const inlineThreadIsOutdated = (input: { startLine: number; endLine: number; diff: string }) => {
  for (const match of input.diff.matchAll(hunkPattern)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (count === 0) continue;
    const end = start + count - 1;
    if (start <= input.endLine && end >= input.startLine) return true;
  }
  return false;
};
