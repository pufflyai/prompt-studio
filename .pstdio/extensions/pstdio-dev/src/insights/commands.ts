import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { buildAnalysis, buildDigest } from "./analyze";
import { options } from "./options";
import { renderReport } from "./report";
import { startReview } from "./review";
import { scanSessions } from "./scan";
import { type Analysis, listAnalysisRows, readAnalyses, readAnalysis, saveAnalyses } from "./store";
import {
  failureModeIds,
  failureModes,
  isFailureMode,
  isOutcome,
  outcomeIds,
  outcomes,
  type Remediation,
} from "./taxonomy";

export { scanSessions, startReview };

export const listAnalyses = defineCommand({
  id: "insights.list",
  title: l10n("insights.commands.list", "List analyzed sessions"),
  description: "List analyzed sessions, newest first. Use --needs-review to get the sessions an agent should classify.",
  cli: {
    examples: [
      "pst pstdio.dev insights list --needs-review --limit 20",
      "pst pstdio.dev insights list --outcome failed",
    ],
  },
  params: {
    outcome: params.select({ label: "Outcome", options: options(outcomeIds) }),
    failureMode: params.select({ label: "Failure mode", options: options(failureModeIds) }),
    needsReview: params.boolean({ label: "Only sessions that need an agent review" }),
    source: params.select({ label: "Source", options: options(["heuristic", "agent"]) }),
    limit: params.number({ label: "Most rows", defaultValue: 50 }),
  },
  async run(ctx, input) {
    const rows = await listAnalysisRows(ctx, ctx.signal);
    return rows
      .filter(
        (row) =>
          (!input.outcome || row.outcome === input.outcome) &&
          (!input.failureMode || row.failureMode === input.failureMode) &&
          (!input.needsReview || row.needsReview) &&
          (!input.source || row.source === input.source),
      )
      .slice(0, Math.max(1, input.limit ?? 50))
      .map(({ sessionId, title, outcome, failureMode, confidence, source, corrections, toolFailures, evidence }) => ({
        sessionId,
        title: title.slice(0, 120),
        outcome,
        failureMode,
        confidence,
        source,
        corrections,
        toolFailures,
        evidence,
      }));
  },
});

export const readTranscript = defineCommand({
  id: "insights.transcript",
  title: l10n("insights.commands.transcript", "Read session digest"),
  description:
    "Print a bounded transcript of one session: each user request, tool failures, errors, and the agent's first and final replies.",
  cli: { examples: ["pst pstdio.dev insights transcript --session-id <id>"] },
  params: {
    sessionId: params.text({ label: "Session ID", required: true, resolvedFrom: "resource" }),
    maxChars: params.number({ label: "Most characters", defaultValue: 16_000 }),
  },
  async run(ctx, input) {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) throw new Error(`Session not found: ${input.sessionId}`);
    const conversation = await ctx.sessions.getConversation(input.sessionId);
    const analysis = await readAnalysis(ctx, input.sessionId);
    return {
      digest: buildDigest(session, conversation, input.maxChars ?? 16_000),
      current: analysis
        ? {
            outcome: analysis.outcome,
            failureMode: analysis.failureMode,
            source: analysis.source,
            evidence: analysis.evidence,
          }
        : null,
    };
  },
});

type VerdictInput = { outcome: string; failureMode?: string; secondaryModes?: string[]; lesson?: string };

/** Refuses verdicts the report could not group or learn from. */
const validateVerdict = (input: VerdictInput) => {
  const { outcome } = input;
  if (!isOutcome(outcome)) throw new Error(`Unknown outcome "${outcome}". Run \`pst pstdio.dev insights taxonomy\`.`);
  const mode = input.failureMode ?? "";
  if (mode && !isFailureMode(mode))
    throw new Error(`Unknown failure mode "${mode}". Run \`pst pstdio.dev insights taxonomy\`.`);
  const behavioral = outcome === "failed" || outcome === "partial";
  if ((behavioral || outcome === "infra_failure") && !mode)
    throw new Error(`Outcome "${outcome}" needs --failure-mode.`);
  if (behavioral && !input.lesson?.trim())
    throw new Error(`Outcome "${outcome}" needs --lesson: what would have prevented it.`);
  const secondary = (input.secondaryModes ?? []).filter((value) => value !== mode);
  const unknown = secondary.find((value) => !isFailureMode(value));
  if (unknown) throw new Error(`Unknown failure mode "${unknown}".`);
  return {
    outcome,
    failureMode: isFailureMode(mode) ? mode : ("" as const),
    secondaryModes: secondary.filter(isFailureMode),
  };
};

export const classifySession = defineCommand({
  id: "insights.classify",
  mutating: true,
  title: l10n("insights.commands.classify", "Classify session"),
  description:
    "Record an agent's verdict for one session. Failed and partial outcomes need a failure mode, evidence quoted from the transcript, and a lesson.",
  cli: {
    examples: [
      'pst pstdio.dev insights classify --session-id <id> --outcome partial --failure-mode unwanted_action --evidence "User: why are you switching mirror?" --lesson "Preserve the failing run and diagnose its owning phase. Do not switch package mirrors for an intermittent outage or retry unchanged failures to obtain a pass; follow current CI policy and explicit task instructions." --remediation docs --remediation-target AGENTS.md',
    ],
  },
  params: {
    sessionId: params.text({ label: "Session ID", required: true, resolvedFrom: "resource" }),
    outcome: params.select({ label: "Outcome", required: true, options: options(outcomeIds) }),
    failureMode: params.select({ label: "Failure mode", options: options(failureModeIds) }),
    secondaryModes: params.list({ label: "Other failure modes" }),
    confidence: params.select({
      label: "Confidence",
      options: options(["low", "medium", "high"]),
      defaultValue: "medium",
    }),
    evidence: params.longText({ label: "Evidence", required: true }),
    lesson: params.longText({ label: "Lesson for future agents" }),
    remediation: params.select({
      label: "Fix type",
      options: options(["skill", "docs", "tooling", "harness", "none"]),
    }),
    remediationTarget: params.text({ label: "Fix target (skill name or doc path)" }),
  },
  async run(ctx, input) {
    const { outcome, failureMode, secondaryModes } = validateVerdict(input);
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) throw new Error(`Session not found: ${input.sessionId}`);
    let analysis = await readAnalysis(ctx, input.sessionId);
    if (!analysis || analysis.sessionUpdatedAt !== session.updatedAt) {
      const conversation = await ctx.sessions.getConversation(input.sessionId);
      analysis = buildAnalysis(session, conversation, undefined);
    }
    const { earlierLesson: _earlierLesson, ...current } = analysis;
    const updated: Analysis = {
      ...current,
      outcome,
      failureMode,
      secondaryModes,
      confidence: (input.confidence as Analysis["confidence"] | undefined) ?? "medium",
      source: "agent",
      needsReview: false,
      evidence: input.evidence.trim(),
      lesson: input.lesson?.trim() ?? "",
      remediation:
        (input.remediation as Remediation | undefined) ?? (failureMode ? failureModes[failureMode].remediation : ""),
      remediationTarget: input.remediationTarget?.trim() ?? "",
      analyzedAt: new Date().toISOString(),
    };
    await saveAnalyses(ctx, [updated]);
    return { sessionId: updated.sessionId, outcome: updated.outcome, failureMode: updated.failureMode };
  },
});

export const showTaxonomy = defineCommand({
  id: "insights.taxonomy",
  title: l10n("insights.commands.taxonomy", "Show outcomes and failure modes"),
  description: "Print every outcome and failure mode with its signals and usual fix.",
  cli: true,
  run: () => ({ outcomes, failureModes }),
});

export const writeReport = defineCommand({
  id: "insights.report",
  mutating: true,
  title: l10n("insights.commands.report", "Write failure report"),
  description:
    "Group failed and partial sessions by failure mode with their lessons and fix targets. Saves Markdown in the extension's project folder when available.",
  cli: { examples: ["pst pstdio.dev insights report", "pst pstdio.dev insights report --agent-only"] },
  palette: [{ label: l10n("insights.commands.report", "Write failure report") }],
  params: {
    agentOnly: params.boolean({ label: "Only agent-reviewed sessions" }),
    examples: params.number({ label: "Example sessions per mode", defaultValue: 5 }),
  },
  async run(ctx, input) {
    const rows = await listAnalysisRows(ctx, ctx.signal);
    const ids = rows
      .filter((row) => (row.outcome === "failed" || row.outcome === "partial") && row.source === "agent")
      .map((row) => row.sessionId);
    const detailed = await readAnalyses(ctx, ids);
    const report = renderReport(rows, detailed, {
      agentOnly: input.agentOnly ?? false,
      examples: input.examples ?? 5,
      generatedAt: new Date().toISOString(),
    });
    let path: string | undefined;
    if (ctx.extensionFiles) {
      const file = `reports/session-insights-${new Date().toISOString().slice(0, 10)}.md`;
      await ctx.extensionFiles.writeText(file, report.markdown);
      path = `.pstdio/extension-storage/${ctx.extensionId}/${file}`;
    }
    return { path, summary: report.summary, markdown: report.markdown };
  },
});

export const commands = [
  scanSessions,
  listAnalyses,
  readTranscript,
  classifySession,
  showTaxonomy,
  writeReport,
  startReview,
];
