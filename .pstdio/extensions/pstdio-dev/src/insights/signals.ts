import type { ExtensionSessionsApi } from "@pstdio/sdk/extensions";
import type { FailureMode, Outcome } from "./taxonomy";

export type SessionMessage = Awaited<ReturnType<ExtensionSessionsApi["getConversation"]>>["messages"][number];
type Part = SessionMessage["parts"][number];
type ToolPart = Extract<Part, { type: "tool" }>;

export type SessionMeta = {
  status: string;
  exitCause?: string | null;
};

/** One user request and everything the agent did until the next real user message. */
export type Turn = {
  user: string;
  /** Planner, resume and notification messages are prompts too, but not written by the person. */
  automated: boolean;
  assistantTexts: string[];
  toolCalls: number;
  toolFailures: { tool: string; error: string }[];
  toolDenied: number;
  errors: string[];
  notices: string[];
};

export type Signals = {
  userTurns: number;
  corrections: number;
  correctionQuotes: string[];
  statusQuestions: number;
  resumeNudges: number;
  praise: number;
  toolCalls: number;
  toolFailures: number;
  toolDenied: number;
  interruptions: number;
  errors: string[];
  usageLimit: boolean;
  connectionLost: boolean;
  harnessError: boolean;
};

export type HeuristicVerdict = {
  outcome: Outcome;
  failureMode: FailureMode | null;
  confidence: "low" | "medium" | "high";
  /** True when an agent review should decide; heuristics only triage these. */
  needsReview: boolean;
  evidence: string;
};

const NOTIFICATION =
  /^\s*(<(task-notification|system-reminder|local-command[\w-]*|command-[\w-]+)>|Base directory for this skill:)/i;
const AUTOMATED =
  /^(Human input (needed|is resolved)|Implement ticket|Refine ticket|Code review:|Review the changes in the current workspace)/i;
const RESUME = /^\s*(resume|continue|go on|keep going|proceed|carry on|go ahead)\b[.!]?\s*$/i;
const CORRECTION = [
  /^\s*(no|nope|wrong)\b[\s,.!]/i,
  /^\s*stop( it| that| doing\b|[.!]*$)/i,
  /\b(don'?t|do not) (do|touch|change|add|use|switch|create|remove|delete|open|merge|push)\b/i,
  /\bwhy (are|did|is|would|do) you\b/i,
  /\b(that'?s|this is|it'?s) (wrong|not (what|right|it))\b/i,
  /\bnot what i (asked|meant|wanted|said)\b/i,
  /\bi (said|told you|asked( you)? (to|for))\b/i,
  /\b(revert|undo|roll ?back) (it|that|this|the|your)\b/i,
  /\bstill (fail\w*|broken|not|down|red|doesn'?t|isn'?t|the same)\b/i,
  /\b(doesn'?t|didn'?t|does not|did not|isn'?t|is not) (work|fix|help|pass|compile|build)\w*\b/i,
  /\bhow is (this|that) possible\b/i,
  /\byou (forgot|missed|ignored|broke|didn'?t)\b/i,
  /\b(taking too long|not even green|what is happening|wtf|fuck\w*)\b/i,
];
const STATUS_QUESTION =
  /\b(did you|have you|is it done|are you done|what is the status|what'?s the status|did .* go through)\b/i;
const PRAISE = /\b(thanks|thank you|perfect|great|awesome|nice|lgtm|works now|looks good|well done|ship it)\b/i;
const USAGE_LIMIT =
  /hit your .*limit|rate.?limit|usage limit|quota|model access is disabled|insufficient (credits|balance)|overloaded/i;
const CONNECTION =
  /ECONNRESET|ENOTFOUND|ETIMEDOUT|EPIPE|connection (lost|closed|refused|reset)|socket|fetch failed|network error/i;
const HARNESS = /already has an active writer|crash|step interrupted|worker (lost|exited)|harness/i;
const INTERRUPTED = /previous response was interrupted/i;

const textOf = (parts: Part[]) =>
  parts
    .filter((part): part is Extract<Part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

/** Drops IDE context blocks that editors prepend, keeping the person's request. */
export const userRequestText = (text: string) => {
  const marker = text.search(/^## My request( for [\w ]+)?:\s*$/m);
  if (marker >= 0) return text.slice(text.indexOf("\n", marker) + 1).trim();
  return text.trim();
};

const isToolFailure = (part: ToolPart) =>
  part.status === "failed" || part.state?.status === "error" || part.state?.status === "failed";

const errorTextOf = (part: ToolPart) => {
  if (part.state?.errorText) return part.state.errorText;
  const output = part.state?.output;
  if (typeof output === "string") return output;
  return output === undefined ? "" : JSON.stringify(output);
};

const emptyTurn = (user: string, automated: boolean): Turn => ({
  user,
  automated,
  assistantTexts: [],
  toolCalls: 0,
  toolFailures: [],
  toolDenied: 0,
  errors: [],
  notices: [],
});

const recordPart = (turn: Turn, part: Part) => {
  if (part.type === "error") turn.errors.push(part.message ?? part.errorType);
  if (part.type !== "tool") return;
  turn.toolCalls += 1;
  if (part.status === "denied") turn.toolDenied += 1;
  else if (isToolFailure(part)) turn.toolFailures.push({ tool: part.tool, error: errorTextOf(part) });
};

const recordMessage = (turn: Turn, message: SessionMessage, text: string) => {
  if (message.role === "user" && text) turn.notices.push("[background task notification]");
  if (message.role === "system" && INTERRUPTED.test(text)) turn.notices.push("[response interrupted]");
  for (const part of message.parts) recordPart(turn, part);
  if (message.role === "assistant" && text) turn.assistantTexts.push(text);
};

export const segmentTurns = (messages: SessionMessage[]): Turn[] => {
  const turns: Turn[] = [];
  for (const message of messages) {
    const text = textOf(message.parts);
    if (message.role === "user" && text && !NOTIFICATION.test(text)) {
      const request = userRequestText(text);
      turns.push(emptyTurn(request, AUTOMATED.test(request) || RESUME.test(request)));
      continue;
    }
    if (!turns.length) turns.push(emptyTurn("", true));
    recordMessage(turns[turns.length - 1]!, message, text);
  }
  return turns;
};

const emptySignals = (): Signals => ({
  userTurns: 0,
  corrections: 0,
  correctionQuotes: [],
  statusQuestions: 0,
  resumeNudges: 0,
  praise: 0,
  toolCalls: 0,
  toolFailures: 0,
  toolDenied: 0,
  interruptions: 0,
  errors: [],
  usageLimit: false,
  connectionLost: false,
  harnessError: false,
});

/** Reads what a follow-up says about the previous work. */
const scoreFollowUp = (signals: Signals, text: string) => {
  if (CORRECTION.some((pattern) => pattern.test(text))) {
    signals.corrections += 1;
    if (signals.correctionQuotes.length < 3) signals.correctionQuotes.push(text.slice(0, 200));
  } else if (STATUS_QUESTION.test(text)) signals.statusQuestions += 1;
  if (PRAISE.test(text)) signals.praise += 1;
};

const scoreError = (signals: Signals, error: string) => {
  if (!signals.errors.includes(error) && signals.errors.length < 5) signals.errors.push(error);
  if (USAGE_LIMIT.test(error)) signals.usageLimit = true;
  else if (CONNECTION.test(error)) signals.connectionLost = true;
  else if (HARNESS.test(error)) signals.harnessError = true;
};

export const extractSignals = (turns: Turn[]): Signals => {
  const signals = emptySignals();
  turns.forEach((turn, index) => {
    if (turn.user && !turn.automated) signals.userTurns += 1;
    if (RESUME.test(turn.user)) signals.resumeNudges += 1;
    // The first request cannot correct earlier work.
    if (index > 0 && !turn.automated) scoreFollowUp(signals, turn.user);
    signals.toolCalls += turn.toolCalls;
    signals.toolFailures += turn.toolFailures.length;
    signals.toolDenied += turn.toolDenied;
    signals.interruptions += turn.notices.filter((notice) => notice === "[response interrupted]").length;
    for (const error of turn.errors) scoreError(signals, error);
  });
  return signals;
};

const active = new Set(["in_progress", "awaiting_input", "queued"]);

const verdict = (
  outcome: Outcome,
  failureMode: FailureMode | null,
  confidence: HeuristicVerdict["confidence"],
  needsReview: boolean,
  evidence: string,
): HeuristicVerdict => ({ outcome, failureMode, confidence, needsReview, evidence });

const endedBadly = (meta: SessionMeta) => meta.status === "failed" || meta.status === "disconnected";

/** Infrastructure causes are only the verdict when the user had no complaint about the work itself. */
const infraVerdict = (meta: SessionMeta, signals: Signals): HeuristicVerdict | undefined => {
  if (signals.corrections > 0) return undefined;
  const bad = endedBadly(meta);
  if (signals.usageLimit && bad)
    return verdict("infra_failure", "infra_usage_limit", "high", false, signals.errors[0] ?? "Usage limit reached.");
  if (signals.connectionLost || meta.exitCause === "worker_lost" || meta.status === "disconnected") {
    const fallback = `Session ${meta.status}${meta.exitCause ? ` (${meta.exitCause})` : ""}.`;
    return verdict("infra_failure", "infra_connection", bad ? "high" : "medium", !bad, signals.errors[0] ?? fallback);
  }
  if (signals.harnessError && bad)
    return verdict("infra_failure", "infra_harness", "medium", false, signals.errors[0] ?? "Harness error.");
  return undefined;
};

/** Behavior guesses. Every one of them asks for an agent review. */
const frictionVerdict = (meta: SessionMeta, signals: Signals): HeuristicVerdict | undefined => {
  if (signals.corrections > 0) {
    const quote = signals.correctionQuotes[0] ? `User: "${signals.correctionQuotes[0]}"` : "";
    const outcome: Outcome = signals.corrections >= 2 || endedBadly(meta) ? "failed" : "partial";
    return verdict(outcome, null, "low", true, `${signals.corrections} correction(s). ${quote}`.trim());
  }
  if (signals.resumeNudges >= 2)
    return verdict("partial", "premature_stop", "low", true, `User had to say "resume" ${signals.resumeNudges} times.`);
  const failureRate = signals.toolFailures / Math.max(signals.toolCalls, 1);
  if (signals.toolFailures >= 15 && failureRate >= 0.25) {
    const evidence = `${signals.toolFailures} of ${signals.toolCalls} tool calls failed.`;
    return verdict("partial", "stuck_or_looping", "low", true, evidence);
  }
  if (signals.statusQuestions >= 2) {
    const evidence = `User asked for status ${signals.statusQuestions} times.`;
    return verdict("partial", "poor_communication", "low", true, evidence);
  }
  return undefined;
};

/**
 * Triage only. Infrastructure failures are reliable from errors and exits; anything
 * about agent behavior is a guess that `needsReview` hands to an agent review.
 */
export const heuristicVerdict = (meta: SessionMeta, signals: Signals): HeuristicVerdict => {
  if (active.has(meta.status)) return verdict("in_progress", null, "high", false, `Session is ${meta.status}.`);
  const judged = infraVerdict(meta, signals) ?? frictionVerdict(meta, signals);
  if (judged) return judged;
  if (meta.status === "cancelled" || meta.exitCause === "user_stop")
    return verdict("unclear", "user_cancelled", "low", true, "Cancelled without a visible reason.");
  if (meta.status === "failed")
    return verdict("failed", null, "low", true, signals.errors[0] ?? "Session failed without a recorded error.");
  if (signals.praise > 0) return verdict("success", null, "high", false, "User approved the result.");
  return verdict("success", null, signals.userTurns <= 1 ? "medium" : "low", false, "Completed without corrections.");
};
