import { definePage, defineView, l10n, sessionBrowser, viewDataEvents, workbenchModes } from "@pstdio/sdk/extensions";
import { scanSessions, startReview, writeReport } from "./commands";
import { analysesChanged, listAnalysisRows } from "./store";
import { failureModeLabel } from "./taxonomy";

const tableSettings = (grouping: string) => ({
  grouping,
  rowNumbers: false,
  wrapRows: false,
  showStats: true,
  hiddenColumns: ["agent", "model", "userTurns", "durationMinutes", "remediationTarget", "confidence"],
  columnOrder: [],
});

const outcomeIs = (...values: string[]) => ({
  conjunction: "and" as const,
  rules: [],
  groups: [
    {
      conjunction: "or" as const,
      rules: values.map((value) => ({ attributeId: "outcome", condition: "is" as const, value })),
    },
  ],
});

export const sessionsTable = defineView({
  id: "session-insights",
  title: l10n("insights.view.title", "Session insights"),
  icon: "chart-no-axes-column",
  body: {
    kind: "dataTable",
    refreshEvents: [analysesChanged, viewDataEvents.sessionsChanged],
    columns: [
      { id: "title", label: "Session" },
      { id: "outcome", label: "Outcome", groupable: true },
      { id: "failureMode", label: "Failure mode", groupable: true },
      { id: "evidence", label: "Evidence" },
      { id: "lesson", label: "Lesson" },
      { id: "remediation", label: "Fix type", groupable: true },
      { id: "remediationTarget", label: "Fix target", groupable: true },
      { id: "source", label: "Judged by", groupable: true },
      { id: "confidence", label: "Confidence", groupable: true },
      { id: "needsReview", label: "Needs review", type: "boolean" },
      { id: "corrections", label: "Corrections", type: "number" },
      { id: "toolFailures", label: "Tool failures", type: "number" },
      { id: "userTurns", label: "User turns", type: "number" },
      { id: "durationMinutes", label: "Minutes", type: "number" },
      { id: "agent", label: "Harness", groupable: true },
      { id: "model", label: "Model", groupable: true },
      { id: "created", label: "Created", type: "date" },
    ],
    defaultViews: [
      {
        id: "failures",
        title: "Failures",
        filter: outcomeIs("failed", "partial"),
        settings: tableSettings("failureMode"),
      },
      {
        id: "needs-review",
        title: "Needs review",
        filter: { conjunction: "and", rules: [{ attributeId: "needsReview", condition: "is", value: true }] },
        settings: tableSettings("outcome"),
      },
      { id: "successes", title: "Successes", filter: outcomeIs("success"), settings: tableSettings("") },
      {
        id: "infra",
        title: "Infrastructure",
        filter: outcomeIs("infra_failure"),
        settings: tableSettings("failureMode"),
      },
      { id: "all", title: "All", settings: tableSettings("outcome") },
    ],
    defaultActiveViewId: "failures",
    toolbarActions: [
      {
        id: "review",
        label: "Review with agent",
        icon: "sparkles",
        presentation: "primary",
        command: startReview.ref,
        input: startReview.params,
        submitLabel: "Start review",
      },
      { id: "scan", label: "Scan sessions", icon: "refresh-cw", command: scanSessions.ref },
      { id: "report", label: "Write report", icon: "file-text", command: writeReport.ref },
    ],
    onRowActivate(ctx, { row }) {
      ctx.navigation.open({
        kind: "page",
        page: sessionBrowser.pages.session,
        resource: { type: "session", id: row.id, extensionId: "pstdio", projectId: ctx.projectId },
      });
    },
    async query(ctx) {
      const rows = await listAnalysisRows(ctx);
      return {
        rows: rows.map((row) => ({
          id: row.sessionId,
          values: {
            title: row.title,
            outcome: row.outcome,
            failureMode: failureModeLabel(row.failureMode),
            evidence: row.evidence,
            lesson: row.lesson,
            remediation: row.remediation,
            remediationTarget: row.remediationTarget,
            source: row.source,
            confidence: row.confidence,
            needsReview: row.needsReview,
            corrections: row.corrections,
            toolFailures: row.toolFailures,
            userTurns: row.userTurns,
            durationMinutes: row.durationMinutes,
            agent: row.agent,
            model: row.model,
            created: row.sessionCreatedAt,
          },
        })),
      };
    },
  },
});

export const insightsPage = definePage({
  id: "session-insights",
  title: l10n("insights.page.title", "Session insights"),
  path: "session-insights",
  icon: "chart-no-axes-column",
  mode: workbenchModes.project,
  main: { kind: "view", view: sessionsTable.ref, cardinality: "one" },
  slots: [],
});
