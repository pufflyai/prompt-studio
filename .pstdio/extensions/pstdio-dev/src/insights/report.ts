import type { Analysis, AnalysisRow } from "./store";
import { failureModes, isFailureMode, outcomeIds } from "./taxonomy";

type ReportOptions = { agentOnly: boolean; examples: number; generatedAt: string };

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "0%");
const oneLine = (text: string, max = 240) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const fixTargets = (group: AnalysisRow[]) => {
  const targets = new Map<string, number>();
  for (const row of group)
    if (row.remediationTarget) targets.set(row.remediationTarget, (targets.get(row.remediationTarget) ?? 0) + 1);
  if (!targets.size) return [];
  const sorted = [...targets].sort((a, b) => b[1] - a[1]);
  return ["Fix targets named by reviewers:", "", ...sorted.map(([target, count]) => `- \`${target}\` (${count})`), ""];
};

const lessonLines = (group: AnalysisRow[]) => {
  const lessons = group.filter((row) => row.lesson && row.source === "agent");
  if (!lessons.length) return [];
  return ["Lessons:", "", ...lessons.map((row) => `- ${oneLine(row.lesson)} — _${row.sessionId}_`), ""];
};

const exampleLine = (row: AnalysisRow, detailed: Map<string, Analysis>) => {
  const secondary = detailed.get(row.sessionId)?.secondaryModes ?? [];
  const also = secondary.length ? `, also ${secondary.join(", ")}` : "";
  return `- **${oneLine(row.title, 100)}** (\`${row.sessionId}\`, ${row.outcome}, ${row.source}${also}): ${oneLine(row.evidence)}`;
};

const renderModeSection = (mode: string, group: AnalysisRow[], detailed: Map<string, Analysis>, examples: number) => {
  const definition = isFailureMode(mode) ? failureModes[mode] : undefined;
  const intro = definition
    ? [definition.description, "", `Usual fix: ${definition.fixHint}`, ""]
    : ["Heuristics flagged these, but no agent has named the failure mode yet.", ""];
  return [
    "",
    `## ${definition?.label ?? "Unclassified"} — ${group.length} session(s)`,
    "",
    ...intro,
    ...fixTargets(group),
    ...lessonLines(group),
    "Examples:",
    "",
    ...group.slice(0, examples).map((row) => exampleLine(row, detailed)),
  ];
};

export const renderReport = (rows: AnalysisRow[], detailed: Map<string, Analysis>, options: ReportOptions) => {
  const judged = rows.filter((row) => row.outcome !== "in_progress");
  const failures = judged.filter(
    (row) => (row.outcome === "failed" || row.outcome === "partial") && (!options.agentOnly || row.source === "agent"),
  );
  const counts = Object.fromEntries(outcomeIds.map((id) => [id, judged.filter((row) => row.outcome === id).length]));
  const byMode = new Map<string, AnalysisRow[]>();
  for (const row of failures) {
    const mode = row.failureMode || "unclassified";
    const group = byMode.get(mode) ?? [];
    group.push(row);
    byMode.set(mode, group);
  }
  const ranked = [...byMode.entries()].sort((a, b) => b[1].length - a[1].length);

  const lines = [
    "# Session insights",
    "",
    `Generated ${options.generatedAt}. ${judged.length} sessions judged; ${rows.filter((r) => r.source === "agent").length} reviewed by an agent, ${rows.filter((r) => r.needsReview).length} still need review.`,
    "",
    "## Outcomes",
    "",
    "| Outcome | Sessions | Share |",
    "| --- | ---: | ---: |",
    ...outcomeIds
      .filter((id) => id !== "in_progress")
      .map((id) => `| ${id} | ${counts[id]} | ${percent(counts[id] ?? 0, judged.length)} |`),
    "",
    `## Failure modes${options.agentOnly ? " (agent-reviewed only)" : ""}`,
    "",
    "| Failure mode | Sessions | Usual fix |",
    "| --- | ---: | --- |",
    ...ranked.map(([mode, group]) => {
      const fix = isFailureMode(mode) ? failureModes[mode].remediation : "review";
      return `| ${isFailureMode(mode) ? failureModes[mode].label : mode} (\`${mode}\`) | ${group.length} | ${fix} |`;
    }),
  ];

  for (const [mode, group] of ranked) lines.push(...renderModeSection(mode, group, detailed, options.examples));

  return {
    markdown: `${lines.join("\n")}\n`,
    summary: {
      judged: judged.length,
      outcomes: counts,
      failureModes: Object.fromEntries(ranked.map(([mode, group]) => [mode, group.length])),
    },
  };
};
