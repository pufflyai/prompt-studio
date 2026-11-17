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
    createdAt: new Date(Date.UTC(2026, 10, 6 + index)).toISOString(),
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
    categories,
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
export default { title: "Extensions/Prompt Studio Dev/Release pipeline health", fullscreen: true };
export const ReleaseHealth = () => {
  const [state, setState] = useState("history");
  return (
    <Box h="100dvh" display="flex" flexDirection="column" minH="0">
      <HStack p="sm">
        {["history", "empty", "error"].map((value) => (
          <Button key={value} size="xs" onClick={() => setState(value)}>
            {value}
          </Button>
        ))}
      </HStack>
      <Box flex="1" minH="0">
        <HealthView
          runs={state === "empty" ? [] : runs}
          refreshing={false}
          error={state === "error" ? "GitHub is unreachable; cached results are shown." : undefined}
          onRefresh={() => {}}
          onOpen={() => {}}
        />
      </Box>
    </Box>
  );
};
