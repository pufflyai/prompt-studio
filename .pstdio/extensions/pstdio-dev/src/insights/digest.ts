import type { Signals, Turn } from "./signals";

export type DigestHeader = {
  id: string;
  title: string;
  status: string;
  agent: string | null;
  model: string | null;
  exitCause?: string | null;
  createdAt: string;
};

const SEPARATOR = "\n\n";

const clip = (text: string, max: number) => {
  const flat = text.replace(/\n{3,}/g, "\n\n").trim();
  // Cutting a few characters saves nothing and hides words.
  if (flat.length <= max + 80) return flat;
  const head = Math.ceil(max * 0.6);
  return `${flat.slice(0, head)} […${flat.length - max} chars…] ${flat.slice(flat.length - (max - head))}`;
};

const renderTurn = (turn: Turn, index: number) => {
  const lines = [`### Turn ${index + 1}${turn.automated ? " (automated prompt)" : ""}`];
  if (turn.user) lines.push(`USER: ${clip(turn.user, 1200)}`);
  const failed = turn.toolFailures.length;
  if (turn.toolCalls)
    lines.push(
      `TOOLS: ${turn.toolCalls} calls, ${failed} failed${turn.toolDenied ? `, ${turn.toolDenied} denied` : ""}`,
    );
  for (const failure of turn.toolFailures.slice(0, 3)) lines.push(`  ✗ ${failure.tool}: ${clip(failure.error, 220)}`);
  if (failed > 3) lines.push(`  … ${failed - 3} more failures`);
  for (const error of [...new Set(turn.errors)].slice(0, 3)) lines.push(`ERROR: ${clip(error, 300)}`);
  for (const notice of [...new Set(turn.notices)]) lines.push(`NOTE: ${notice}`);
  const texts = turn.assistantTexts;
  // The first reply shows the plan; the last shows what the agent claimed.
  if (texts.length > 1) lines.push(`AGENT (first): ${clip(texts[0]!, 400)}`);
  if (texts.length) lines.push(`AGENT (final): ${clip(texts[texts.length - 1]!, 1500)}`);
  else lines.push("AGENT: (no text reply)");
  return lines.join("\n");
};

/**
 * Renders a bounded plain-text transcript for review. Long sessions keep their
 * opening and closing turns, which hold the request and the end state.
 */
export const renderDigest = (header: DigestHeader, signals: Signals, turns: Turn[], maxChars = 16_000) => {
  const head = [
    `# ${header.title}`,
    `session: ${header.id} · status: ${header.status}${header.exitCause ? ` (${header.exitCause})` : ""} · agent: ${header.agent ?? "?"} · model: ${header.model ?? "?"} · created: ${header.createdAt}`,
    `signals: ${signals.userTurns} user turns, ${signals.corrections} corrections, ${signals.resumeNudges} resume nudges, ${signals.toolFailures}/${signals.toolCalls} tool calls failed, ${signals.toolDenied} denied, ${signals.interruptions} interruptions`,
    "",
  ].join("\n");
  const rendered = turns.map(renderTurn);
  const full = head + rendered.join("\n\n");
  // The limit covers the header, separators and omission marker too.
  if (full.length <= maxChars || !rendered.length) return full.slice(0, maxChars);

  const gapLine = (omitted: number) => `[… ${omitted} turn(s) omitted …]`;
  let budget = maxChars - head.length - gapLine(rendered.length).length - SEPARATOR.length;
  const take = (text: string, room: number) => {
    const kept = text.length <= room ? text : `${text.slice(0, Math.max(0, room - 1))}…`;
    budget -= kept.length + SEPARATOR.length;
    return kept;
  };
  // The opening request and the end state always keep a share, truncated when a turn is too long.
  const single = rendered.length === 1;
  const first = [take(rendered[0]!, (single ? budget : Math.floor(budget / 2)) - SEPARATOR.length)];
  const last = single ? [] : [take(rendered.at(-1)!, budget - SEPARATOR.length)];
  let left = 1;
  let right = rendered.length - 2;
  // Fill from both ends so the context around the request and the outcome both survive.
  while (left <= right) {
    const takeLeft = first.length <= last.length;
    const next = rendered[takeLeft ? left : right]!;
    if (next.length + SEPARATOR.length > budget) break;
    budget -= next.length + SEPARATOR.length;
    if (takeLeft) first.push(rendered[left++]!);
    else last.unshift(rendered[right--]!);
  }
  const omitted = right - left + 1;
  const gap = omitted > 0 ? [gapLine(omitted)] : [];
  return (head + [...first, ...gap, ...last].join(SEPARATOR)).slice(0, maxChars);
};
