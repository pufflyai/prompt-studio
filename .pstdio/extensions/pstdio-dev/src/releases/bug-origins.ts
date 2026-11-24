import type { BugOriginCounts, PullRequestType } from "./types";

export const BUG_ORIGIN_AUDIT = "releases/pull-request-bug-origins.json";

interface MergedPull {
  number: number;
  mergedAt: string;
  type: PullRequestType;
}

type BugOriginAssessment = { evidence: string } & (
  | { origin: number; confidence: "explicit" | "inferred" }
  | { origin: null; confidence: "unlinked" }
);

export interface BugOriginAudit {
  repository: string;
  reviewedThrough: string;
  assessments: Record<string, BugOriginAssessment>;
}

export const emptyBugOriginCounts = () => ({ features: 0, fixes: 0, inferred: 0 });

export const addBugOriginCounts = (target: BugOriginCounts, counts: BugOriginCounts) => {
  target.features += counts.features;
  target.fixes += counts.fixes;
  target.inferred += counts.inferred;
};

/** Where a reviewed bug fix's origin leads: a feature merged before it, or why it does not count. */
const linkFix = (fix: MergedPull, assessment: BugOriginAssessment, byNumber: ReadonlyMap<number, MergedPull>) => {
  const origin = assessment.origin === null ? undefined : byNumber.get(assessment.origin);
  if (!origin) return { kind: "unlinked" } as const;
  if (Date.parse(origin.mergedAt) >= Date.parse(fix.mergedAt))
    return { kind: assessment.confidence === "explicit" ? "preMergeFixes" : "unlinked" } as const;
  if (origin.type !== "feature") return { kind: "linkedToOther" } as const;
  return { kind: "feature", origin } as const;
};

export const summarizeBugOrigins = (pulls: MergedPull[], audit: BugOriginAudit) => {
  const { reviewedThrough, assessments } = audit;
  const cutoff = Date.parse(reviewedThrough);
  const reviewedPulls = pulls.filter(({ mergedAt }) => Date.parse(mergedAt) <= cutoff);
  const byNumber = new Map(reviewedPulls.map((pull) => [pull.number, pull]));
  const days = new Map<string, BugOriginCounts>();
  // Hourly counts use UTC keys such as 2026-11-20T09:00Z, matching the dashboard's hour buckets.
  const hours = new Map<string, BugOriginCounts>();
  const hourOf = (mergedAt: string) => `${new Date(mergedAt).toISOString().slice(0, 13)}:00Z`;
  const coverage = {
    reviewedThrough,
    reviewed: Object.keys(assessments).length,
    mergedReviewed: 0,
    linkedToFeatures: 0,
    linkedToOther: 0,
    preMergeFixes: 0,
    unlinked: 0,
  };

  for (const pull of reviewedPulls) {
    if (pull.type !== "feature") continue;
    for (const [map, key] of [
      [days, pull.mergedAt.slice(0, 10)],
      [hours, hourOf(pull.mergedAt)],
    ] as const) {
      const counts = map.get(key) ?? emptyBugOriginCounts();
      counts.features++;
      map.set(key, counts);
    }
  }

  for (const fix of reviewedPulls) {
    const assessment = assessments[fix.number];
    if (fix.type !== "bug" || !assessment) continue;
    coverage.mergedReviewed++;
    const link = linkFix(fix, assessment, byNumber);
    if (link.kind !== "feature") {
      coverage[link.kind]++;
      continue;
    }
    for (const counts of [days.get(link.origin.mergedAt.slice(0, 10))!, hours.get(hourOf(link.origin.mergedAt))!]) {
      counts.fixes++;
      if (assessment.confidence === "inferred") counts.inferred++;
    }
    coverage.linkedToFeatures++;
  }

  return { days, hours, coverage };
};
