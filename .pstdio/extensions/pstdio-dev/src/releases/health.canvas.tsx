import { Box, Button, HStack } from "@chakra-ui/react";
import { useState } from "react";
import { HealthView } from "./health-view";
import type { ReleaseHealth as HealthRun } from "./types";

const runs: HealthRun[] = Array.from({ length: 6 }, (_, index) => {
  const quarantined = 18 + index * 2;
  const categories = {
    "end-to-end": 6000 + index * 60,
    components: 4500,
    backend: 2000 + index * 20,
    packages: 700,
    harness: 200,
    performance: 40,
    quarantine: quarantined,
  };
  const total = Object.values(categories).reduce((sum, count) => sum + count, 0);
  const failed = index % 2 ? 0 : 7;
  return {
    id: 43080161000 + index,
    attempt: 1,
    createdAt: new Date(Date.UTC(2026, 10, 6 + index * 2)).toISOString(),
    sha: "cc0dd9b6e0ca05b08c498203a2d708ae99c08c00",
    url: "https://github.com/pufflyai/prompt-studio/actions",
    title: "Release Packages",
    status: index === 5 ? "in_progress" : "completed",
    conclusion: index === 5 ? null : (["failure", "success"] as const)[index % 2]!,
    counts: {
      passed: total - failed - 12,
      failed,
      skipped: 12,
      reports: 40,
      quarantined,
    },
    categories: index === 0 ? undefined : categories,
    runDurationSeconds: 2700 + index * 120 + (index % 2 ? 45 : 0),
    testJobs: 40,
    reportedJobs: index === 5 ? 20 : 40,
    pendingJobs: index === 5 ? 20 : 0,
    failedJobs:
      index % 2
        ? []
        : [{ name: "Signed desktop functional tests", url: "https://github.com/pufflyai/prompt-studio/actions" }],
    published: true,
    errors: [],
  };
});
const mergeThemes = {
  analyzedAt: "2026-11-17T13:00:00Z",
  names: [
    "Workbench layout and navigation",
    "CI and test reliability",
    "Extensions and SDK",
    "Projects, workspaces and files",
    "Cloud sync and storage",
    "Sessions and conversations",
  ],
};
const bugFailurePatterns = {
  analyzedAt: "2026-11-17T13:00:00Z",
  names: [
    "Alternate actions and UI states",
    "Lifecycle and async ordering",
    "Persistence, migration and offline sync",
    "Packaged, platform and release differences",
    "Scale, latency and resource limits",
    "Readiness, time budgets and fixture isolation",
  ],
  validationIndices: [5],
};
const pullRequestMerges = Array.from({ length: 30 }, (_, index) => {
  const count = index % 7 < 2 ? 0 : 5 + ((index * 11) % 24);
  const bug = Math.round(count * ((index % 5) / 6));
  const feature = Math.round((count - bug) * 0.6);
  const theme = index % mergeThemes.names.length;
  const secondTheme = (theme + 1) % mergeThemes.names.length;
  return {
    date: new Date(Date.UTC(2026, 10, index - 11)).toISOString().slice(0, 10),
    count,
    categories: { bug, feature, chore: count - bug - feature },
    themes: index === 29 ? undefined : { [theme]: bug + feature, [secondTheme]: count - bug - feature },
    bugFailures: index === 29 ? undefined : { [theme]: bug },
    velocity: { points: feature + feature * (index % 3), estimatedFeatures: Math.floor(feature / 3) },
    bugOrigins: feature ? { features: feature, fixes: index % 13, inferred: Math.floor((index % 13) / 2) } : undefined,
  };
});
const mergeTotals = pullRequestMerges.map(({ date, count }) => ({ date, count }));
const publications = [
  { tag: "pstdio@0.46.0", publishedAt: "2026-11-01T02:42:20Z" },
  { tag: "pstdio@0.47.0", publishedAt: "2026-11-12T22:21:28Z" },
  { tag: "pstdio@0.48.0-nightly.20261118071355", publishedAt: "2026-11-18T07:29:26Z" },
];

export default {
  title: "Extensions/Prompt Studio Dev/Release health dashboard",
  description: "Refresh and date filters sit on the left. Dashboard editing controls sit on the right.",
  fullscreen: true,
};
export const ReleaseHealth = () => {
  const [state, setState] = useState("history");
  const refreshing = state === "refreshing";
  const hasHistory = state !== "empty" && !refreshing;
  const merges = state === "totals only" ? mergeTotals : pullRequestMerges;
  return (
    <Box w="full" h="100dvh" display="flex" flexDirection="column" minW="0" minH="0">
      <HStack p="sm" flexWrap="wrap">
        {["history", "merges only", "totals only", "empty", "refreshing", "error"].map((value) => (
          <Button key={value} size="xs" onClick={() => setState(value)}>
            {value}
          </Button>
        ))}
      </HStack>
      <Box flex="1" minH="0">
        <HealthView
          today="2026-11-18"
          runs={hasHistory && state !== "merges only" ? runs : []}
          pullRequestMergesDaily={hasHistory ? merges : undefined}
          mergeThemes={hasHistory && state !== "totals only" ? mergeThemes : undefined}
          bugFailurePatterns={hasHistory && state !== "totals only" ? bugFailurePatterns : undefined}
          bugOriginCoverage={
            !hasHistory || state === "totals only"
              ? undefined
              : {
                  reviewedThrough: "2026-11-18T13:00:00Z",
                  reviewed: 320,
                  mergedReviewed: 290,
                  linkedToFeatures: 184,
                  linkedToOther: 31,
                  preMergeFixes: 0,
                  unlinked: 75,
                }
          }
          publications={hasHistory ? publications : undefined}
          pullRequestMergesError={state === "error" ? "GitHub is unreachable." : undefined}
          refreshing={refreshing}
          error={state === "error" ? "GitHub is unreachable; cached results are shown." : undefined}
          onRefresh={() => setState("refreshing")}
          onOpen={() => {}}
        />
      </Box>
    </Box>
  );
};
