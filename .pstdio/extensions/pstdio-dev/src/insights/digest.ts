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
  let budget = maxChars - head.length;
  const total = rendered.reduce((sum, turn) => sum + turn.length + 2, 0);
  if (total <= budget) return head + rendered.join("\n\n");

  const first: string[] = [];
  const last: string[] = [];
  let left = 0;
  let right = rendered.length - 1;
  // Alternate from both ends so the request and the outcome both survive.
  while (left <= right) {
    const takeLeft = first.length <= last.length;
    const next = rendered[takeLeft ? left : right]!;
    if (next.length + 2 > budget) break;
    budget -= next.length + 2;
    if (takeLeft) first.push(rendered[left++]!);
    else last.unshift(rendered[right--]!);
  }
  const omitted = right - left + 1;
  const gap = omitted > 0 ? [`[… ${omitted} turn(s) omitted …]`] : [];
  return head + [...first, ...gap, ...last].join("\n\n");
};
