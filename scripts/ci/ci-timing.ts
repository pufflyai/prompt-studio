import { type CiJob, isFailedJob, isSummaryJob, passedOnRerun } from "./ci-failures";

export interface CiStepTiming {
  name: string;
  started: string | null;
  completed: string | null;
}

export interface CiFailureCause {
  kind:
    | "product"
    | "nondeterminism"
    | "infrastructure"
    | "merge-conflict"
    | "manual-removal"
    | "queue-invalidation"
    | "unclassified";
  evidence: string[];
}

export interface CiRunTiming {
  id: number;
  workflow: string;
  head_sha: string;
  head_branch: string;
  event: string;
  created_at: string;
  run_attempt?: number;
  conclusion?: string | null;
}

const elapsed = (started?: string | null, completed?: string | null) => {
  if (!started || !completed) return null;
  const duration = Date.parse(completed) - Date.parse(started);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
};

const phaseForStep = (name: string) => {
  if (/cache.*save|save.*cache|post.*cache/i.test(name)) return "cache-save";
  if (/cleanup|clean up|stop isolated|post job|^Post (Setup|Set up|Run|actions\/checkout)|^Complete job/i.test(name))
    return "cleanup";
  if (/upload|report|summarize|summary|artifact/i.test(name)) return "report";
  if (/test|smoke|conformance|benchmark|playwright/i.test(name)) return "test";
  if (/build|compil/i.test(name)) return "build";
  if (/checkout|setup|set up|install|download|restore.*cache/i.test(name)) return "setup";
  return "unclassified";
};

const stageForRun = (job: Pick<CiJob, "workflow" | "event" | "branch">) => {
  if (job.workflow.startsWith("release-")) return "release";
  if (job.event === "merge_group") return "merge_queue";
  if (job.event === "push" && job.branch === "main") return "main";
  // PR runs no longer change scope by label; full diagnostics are manual dispatches.
  if (job.event === "pull_request") return "pull_request";
  return job.event;
};

const jobTiming = (job: CiJob) => {
  const phases: Record<string, number> = {};
  for (const step of job.steps ?? []) {
    const duration = elapsed(step.started, step.completed);
    if (duration === null) continue;
    const phase = phaseForStep(step.name);
    phases[phase] = (phases[phase] ?? 0) + duration;
  }
  return {
    id: job.id,
    name: job.name,
    conclusion: job.conclusion,
    created: job.created ?? null,
    started: job.started,
    completed: job.completed,
    runner: job.runner ?? null,
    labels: job.labels ?? [],
    runnerWaitMs: elapsed(job.created, job.started),
    executionMs: elapsed(job.started, job.completed),
    phases,
    cause: job.cause?.evidence.length ? job.cause : { kind: "unclassified", evidence: [] },
  };
};

export const summarizeCiTiming = (input: CiJob[], observedRuns: CiRunTiming[] = []) => {
  const metadata = new Map(observedRuns.map((run) => [`${run.workflow}/${run.id}`, run]));
  const groups = new Map<string, CiJob[]>([...metadata.keys()].map((key) => [key, []]));
  for (const job of input) {
    const key = `${job.workflow}/${job.runId}`;
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  const runs = [...groups].map(([key, all]) => {
    const first = all.filter((job) => job.attempt === 1);
    const run = metadata.get(key);
    const sample = first[0] ??
      all[0] ?? {
        workflow: run!.workflow,
        runId: run!.id,
        sha: run!.head_sha,
        branch: run!.head_branch,
        event: run!.event,
        runCreated: run!.created_at,
      };
    const gate = first.find((job) => /(?:^| \/ )(?:production_)?ci_passed$/.test(job.name));
    const executed = first.filter((job) => job.conclusion !== "skipped");
    const starts = executed
      .map((job) => job.started)
      .filter((value): value is string => value !== null && Number.isFinite(Date.parse(value)))
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    const started = starts[0] ?? null;
    // Release publication and certification can finish after a nested functional gate.
    const final =
      gate?.completed && executed.every((job) => job.completed && Number.isFinite(Date.parse(job.completed)))
        ? (executed
            .map((job) => job.completed!)
            .sort((a, b) => Date.parse(a) - Date.parse(b))
            .at(-1) ?? null)
        : null;
    const executions = executed.map((job) => elapsed(job.started, job.completed));
    const totalRunnerMs =
      first.length && executions.every((duration): duration is number => duration !== null)
        ? executions.reduce((sum, duration) => sum + duration, 0)
        : null;
    const nonSuccessfulRun = run?.run_attempt === 1 && run.conclusion !== undefined && run.conclusion !== "success";
    return {
      workflow: sample.workflow,
      runId: sample.runId,
      attempt: 1,
      sha: sample.sha,
      stage: stageForRun(sample),
      wallMs: elapsed(sample.runCreated, final),
      initialWaitMs: elapsed(sample.runCreated, started),
      elapsedAfterStartMs: elapsed(started, final),
      totalRunnerMs,
      // The required gate owns selection. Conditional jobs may be skipped, but a
      // skipped gate, cancelled job, or absent completion cannot certify a run.
      firstAttemptSucceeded: Boolean(
        !nonSuccessfulRun &&
          gate?.conclusion === "success" &&
          final &&
          first.every((job) => job.completed && (job.conclusion === "success" || job.conclusion === "skipped")),
      ),
      missingFirstAttempt: first.length === 0,
      jobs: first.map(jobTiming),
    };
  });
  return {
    runs,
    limits:
      "Aggregate runner time sums parallel work; elapsed after start excludes initial scheduling but can include later scheduling gaps. A dependency critical path needs the workflow graph. Runner wait needs a job creation timestamp. Failure causes stay unclassified without evidence. Merge-candidate creation wait is outside run wall time.",
  };
};

// The stage time targets from the CI stages guide.
const stageTargetsMs = {
  pull_request: 3 * 60_000,
  merge_queue: 8 * 60_000,
  main: 8 * 60_000,
  release: 40 * 60_000,
};

const percentile = (values: number[], share: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(share * sorted.length) - 1]! : null;
};

export const summarizeCiHealth = (
  timing: ReturnType<typeof summarizeCiTiming>,
  jobs: CiJob[],
  observedRuns: CiRunTiming[],
  mergedPulls: number,
) => {
  const stages = Object.entries(stageTargetsMs).map(([stage, targetMs]) => {
    const runs = timing.runs.filter((run) => run.stage === stage);
    const walls = runs.map((run) => run.wallMs).filter((wall): wall is number => wall !== null);
    const runnerMs = runs.reduce((sum, run) => sum + (run.totalRunnerMs ?? 0), 0);
    return {
      stage,
      targetMs,
      runs: runs.length,
      measured: walls.length,
      p50Ms: percentile(walls, 0.5),
      p90Ms: percentile(walls, 0.9),
      withinTarget: walls.filter((wall) => wall <= targetMs).length,
      firstAttemptFailures: runs.filter((run) => !run.firstAttemptSucceeded).length,
      runnerMinutes: Math.round(runnerMs / 60_000),
    };
  });
  // Every attempt counts: a rerun builds the queue entry again.
  const queueRuns = observedRuns
    .filter((run) => run.event === "merge_group")
    .reduce((sum, run) => sum + (run.run_attempt ?? 1), 0);
  const failed = jobs.filter((job) => isFailedJob(job) && !isSummaryJob(job));
  return {
    stages,
    queueRuns,
    mergedPulls,
    queueRunsPerMerge: mergedPulls ? queueRuns / mergedPulls : null,
    failedJobs: failed.length,
    // A queue entry that fails is removed and gets a new commit when added again, so
    // same-commit reruns undercount flakes there.
    passedOnRerun: failed.filter((job) => passedOnRerun(job, jobs)).length,
  };
};
