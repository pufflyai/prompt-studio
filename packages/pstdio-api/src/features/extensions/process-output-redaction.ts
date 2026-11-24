type Match = { start: number; length: number };

/** Reuses each value's next match until the already-redacted span passes it. */
const leftmostMatch = (text: string, values: string[], next: number[], position: number) => {
  let match: Match | undefined;
  for (const [index, value] of values.entries()) {
    if (next[index]! >= 0 && next[index]! < position) next[index] = text.indexOf(value, position);
    const start = next[index]!;
    if (start >= 0 && (!match || start < match.start || (start === match.start && value.length > match.length)))
      match = { start, length: value.length };
  }
  return match;
};

/** Expands a match in one forward sweep over every value that overlaps it. */
const coveredEnd = (text: string, values: string[], start: number, end: number) => {
  let covered = end;
  for (let at = start; at < covered; at++) {
    for (const value of values) {
      if (at + value.length > covered && text.startsWith(value, at)) covered = at + value.length;
    }
  }
  return covered;
};

/** Hides granted values in collected output, including overlapping ones. */
export const redactText = (text: string, values: string[]) => {
  const secrets = [...new Set(values.filter(Boolean))];
  if (!secrets.length) return text;
  const next = secrets.map((value) => text.indexOf(value));
  let result = "";
  let position = 0;
  while (position < text.length) {
    const match = leftmostMatch(text, secrets, next, position);
    if (!match) break;
    result += `${text.slice(position, match.start)}[Redacted]`;
    position = coveredEnd(text, secrets, match.start, match.start + match.length);
  }
  return result + text.slice(position);
};
