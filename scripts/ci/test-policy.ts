export type TestPriority = "P0" | "P1" | "P2" | "P3";
export interface PlannedJob {
  id: string;
  count: number;
  names?: string[];
  priority?: TestPriority;
}
export interface ObservedJob {
  name: string;
  status: string;
  conclusion: string | null;
}

const priorities: Record<string, TestPriority> = {
  scope: "P0",
  source_coverage: "P2",
  static_checks: "P0",
  package_checks: "P0",
  license_check: "P0",
  browser_smoke: "P1",
  windows_test_and_build: "P2",
  windows_database_tests: "P2",
  harness_cli_support: "P2",
  build_docker: "P2",
  quarantined_bun_tests: "P2",
  quarantined_browser_tests: "P2",
  performance: "P3",
  database_tests: "P1",
  components: "P1",
  sdk_api_report: "P0",
  published_extensions: "P0",
  e2e: "P1",
  e2e_cli: "P1",
  packaged_and_vite_e2e: "P1",
  packaged_toolchain: "P2",
  build_clients: "P1",
};

export const priorityForJob = (name: string): TestPriority => {
  const explicit = name.match(/_P([0-3])(?:\b|_)/)?.[1];
  if (explicit) return `P${explicit}` as TestPriority;
  if (/windows_|win32|cli-win/.test(name)) return "P2";
  for (const part of name.split(" / ").reverse()) {
    const id = part.split(" (")[0] ?? part;
    if (priorities[id]) return priorities[id];
  }
  return "P1";
};

// Reusable workflow jobs add a caller prefix; matrix jobs add their parameter suffix.
export const matchesJob = (name: string, id: string) => {
  return name.split(" / ").some((part) => part === id || part.startsWith(`${id} (`));
};

export const isGateJob = (name: string) =>
  ["validation_results", "ci_passed", "production_ci_passed"].some((id) => matchesJob(name, id));

const completedFailure = (job: ObservedJob) => job.status === "completed" && job.conclusion !== "success";

const expectedJobState = (expected: PlannedJob, jobs: ObservedJob[], settled: boolean) => {
  const observed = jobs.filter((job) => matchesJob(job.name, expected.id));
  const unique = new Set(observed.map((job) => job.name));
  const missingNames =
    expected.names?.filter((name) => !observed.some((job) => job.name === name || job.name.endsWith(` / ${name}`))) ??
    [];
  const incomplete = observed.length !== expected.count || unique.size !== expected.count || missingNames.length > 0;
  const failures = observed
    .filter(completedFailure)
    .map((job) => `${job.name}: ${job.conclusion ?? "missing outcome"}`);
  if (settled && incomplete)
    failures.push(
      `${expected.id}: expected ${expected.count} unique results, received ${unique.size}; missing ${missingNames.join(", ")}`,
    );
  return {
    failures,
    pending: incomplete || observed.some((job) => job.status !== "completed"),
    p1Failed: (expected.priority ?? priorityForJob(expected.id)) === "P1" && observed.some(completedFailure),
  };
};

const unexpectedJobState = (plan: PlannedJob[], jobs: ObservedJob[]) => {
  const unexpected = jobs.filter(
    (job) =>
      !isGateJob(job.name) &&
      job.conclusion !== "skipped" &&
      !plan.some((expected) => matchesJob(job.name, expected.id)),
  );
  return {
    failures: unexpected.map((job) => `Unplanned executed job: ${job.name}`),
    pending: unexpected.some((job) => job.status !== "completed"),
    p1Failed: unexpected.some((job) => completedFailure(job) && priorityForJob(job.name) === "P1"),
  };
};

export const evaluateCiGate = (plan: PlannedJob[], jobs: ObservedJob[], failP1Early: boolean, settled = false) => {
  const states = [unexpectedJobState(plan, jobs), ...plan.map((expected) => expectedJobState(expected, jobs, settled))];
  const failures = states.flatMap((state) => state.failures);
  if (failP1Early && states.some((state) => state.p1Failed)) return { outcome: "failure" as const, failures };
  if (!settled && states.some((state) => state.pending)) return { outcome: "pending" as const, failures };
  return { outcome: failures.length ? ("failure" as const) : ("success" as const), failures };
};
