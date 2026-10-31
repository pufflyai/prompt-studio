import type { CiJob } from "./ci-failures";

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

const stageForRun = (job: Pick<CiJob, "workflow" | "event" | "branch" | "fullOverride">) => {
  if (job.workflow.startsWith("release-")) return "release";
  if (job.event === "merge_group") return "merge_queue";
  if (job.event === "push" && job.branch === "main") return "main";
  if (job.event === "pull_request") {
    if (job.fullOverride === undefined) return "pull_request-unclassified";
    return job.fullOverride ? "pull_request-full" : "pull_request";
  }
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
    const gate = first.find((job) => job.name === "ci_passed" || job.name.endsWith(" / ci_passed"));
    const executed = first.filter((job) => job.conclusion !== "skipped");
    const starts = executed
      .map((job) => job.started)
      .filter((value): value is string => value !== null && Number.isFinite(Date.parse(value)))
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    const started = starts[0] ?? null;
    // Release publication and certification can finish after a nested functional gate.
    const final =
      gate?.completed && first.every((job) => job.completed && Number.isFinite(Date.parse(job.completed)))
        ? (first
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
      "Aggregate runner time sums parallel work; elapsed after start excludes initial scheduling but can include later scheduling gaps. A dependency critical path needs the workflow graph. Runner wait needs a job creation timestamp. PR scope and failure causes stay unclassified without evidence. Merge-candidate creation wait is outside run wall time.",
  };
};
