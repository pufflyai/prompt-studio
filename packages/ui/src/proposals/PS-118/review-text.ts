// Quote matching for this local study. Production needs saved offsets and surrounding context.
export function findQuote(text: string, quote: string) {
  const escaped = quote
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!quote.trim()) return null;
  const match = new RegExp(escaped.join("\\s+")).exec(text);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}
