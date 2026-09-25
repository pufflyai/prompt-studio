export interface SmokeCheck {
  id: "setup" | "install-check" | "host-registration" | "page-load" | "webview-load" | "runtime-diagnostics";
  status: "passed" | "failed" | "not-run";
  extensionId?: string;
  contributionId?: string;
  code?: string;
  capability?: string;
  message?: string;
  phase?: string;
}
export interface SmokeResult {
  extension?: { id: string; sourceHash: string };
  host: { version: string };
  browser?: { name: string; version: string };
  result: "passed" | "failed";
  exitCode: number;
  checks: SmokeCheck[];
  coverage: {
    projectContext: "scratch" | "fixture";
    visited: string[];
    unexercised: { contributionId: string; reason: string }[];
    counts: Record<string, number>;
  };
  durations: Record<string, number>;
  evidence?: { directory: string; hostLog: string; browserLog: string };
}
export const formatSmokeResult = (result: SmokeResult) =>
  [
    ...result.checks
      .filter((check) => check.status === "failed")
      .map(
        (check) =>
          `FAIL ${check.id}${check.contributionId ? ` (${check.contributionId})` : ""}: ${check.message ?? check.code}`,
      ),
    `${result.result === "passed" ? "PASS" : "FAIL"}: initial-load smoke checks for ${result.extension?.id ?? "unknown extension"}.`,
    ...(result.extension ? [`Source hash: ${result.extension.sourceHash}`] : []),
    `Host: ${result.host.version}; browser: ${result.browser ? `${result.browser.name} ${result.browser.version}` : "not started"}.`,
    result.coverage.projectContext === "scratch"
      ? "Scratch repository: repo-dependent behavior is not exercised."
      : "Fixture repository copy: initial-load behavior only.",
    `${result.coverage.visited.length} UI surfaces visited. Unvisited contributions and interaction-only calls are not tested.`,
    ...result.coverage.unexercised.map((item) => `Not exercised: ${item.contributionId}: ${item.reason}`),
    ...result.coverage.visited.map((id) => `Visited: ${id}`),
    ...(result.evidence ? [`Evidence retained: ${result.evidence.directory}`] : []),
  ].join("\n");

export const completeSmokeChecks = (result: SmokeResult) => {
  for (const id of [
    "install-check",
    "host-registration",
    "page-load",
    "webview-load",
    "runtime-diagnostics",
  ] as const) {
    if (!result.checks.some((check) => check.id === id))
      result.checks.push({
        id,
        status: "not-run",
        message: result.exitCode ? "Prevented by an earlier failure." : "No applicable surface in the exercise plan.",
      });
  }
  result.result = result.exitCode === 0 ? "passed" : "failed";
};
