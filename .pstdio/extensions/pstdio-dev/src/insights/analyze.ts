import type { ExtensionContextBase, ExtensionSession } from "@pstdio/sdk/extensions";
import { renderDigest } from "./digest";
import { extractSignals, heuristicVerdict, segmentTurns } from "./signals";
import type { Analysis } from "./store";

type Conversation = Awaited<ReturnType<ExtensionContextBase["sessions"]["getConversation"]>>;

/** Test and fixture harnesses produce synthetic sessions that say nothing about agent behavior. */
export const isSyntheticAgent = (agent: string | null | undefined) => !!agent && /\.fake$/.test(agent);

const minutesBetween = (start: string | null | undefined, end: string | null | undefined) => {
  if (!start || !end) return 0;
  const span = Date.parse(end) - Date.parse(start);
  return Number.isFinite(span) && span > 0 ? Math.round(span / 60_000) : 0;
};

export const buildAnalysis = (
  session: ExtensionSession,
  conversation: Conversation,
  previous: Analysis | undefined,
  now = new Date().toISOString(),
): Analysis => {
  const turns = segmentTurns(conversation.messages);
  const signals = extractSignals(turns);
  const exitCause = conversation.session.lastExit?.cause ?? "";
  const verdict = heuristicVerdict({ status: session.status, exitCause }, signals);
  const base = {
    kind: "analysis" as const,
    sessionId: session.id,
    title: session.title,
    agent: session.agent ?? "",
    model: session.lastSelectedModel ?? "",
    status: session.status,
    exitCause,
    sessionCreatedAt: session.createdAt,
    sessionUpdatedAt: session.updatedAt,
    analyzedAt: now,
    userTurns: signals.userTurns,
    corrections: signals.corrections,
    resumeNudges: signals.resumeNudges,
    toolCalls: signals.toolCalls,
    toolFailures: signals.toolFailures,
    toolDenied: signals.toolDenied,
    outputTokens: session.usage?.outputTokens ?? 0,
    durationMinutes: minutesBetween(session.createdAt, session.lastRequestEnded ?? session.updatedAt),
  };
  // An agent verdict on the same conversation outranks a fresh heuristic guess.
  if (previous?.source === "agent" && previous.sessionUpdatedAt === session.updatedAt)
    return { ...previous, ...base, analyzedAt: previous.analyzedAt };
  return {
    ...base,
    outcome: verdict.outcome,
    failureMode: verdict.failureMode ?? "",
    secondaryModes: [],
    confidence: verdict.confidence,
    source: "heuristic",
    // A reviewed session that gained new turns needs another look.
    needsReview: verdict.needsReview || previous?.source === "agent",
    evidence: verdict.evidence,
    lesson: previous?.source === "agent" ? `Earlier review: ${previous.lesson}` : "",
    remediation: "",
    remediationTarget: "",
  };
};

export const buildDigest = (session: ExtensionSession, conversation: Conversation, maxChars?: number) => {
  const turns = segmentTurns(conversation.messages);
  return renderDigest(
    {
      id: session.id,
      title: session.title,
      status: session.status,
      agent: session.agent,
      model: session.lastSelectedModel,
      exitCause: conversation.session.lastExit?.cause,
      createdAt: session.createdAt,
    },
    extractSignals(turns),
    turns,
    maxChars,
  );
};
