import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { gh, ghJson } from "../benchmarks/github";

type Context = Pick<ExtensionContextBase, "process">;
export const RELEASE_WORKFLOW = "release-packages.yml";
export const WORKFLOW_RUN_LIMIT = 100;
export const CANDIDATE_LIMIT = 10;

export interface ReleaseRun {
  id: number;
  path: string;
  run_attempt: number;
  created_at: string;
  run_started_at: string;
  updated_at: string;
  head_sha: string;
  html_url: string;
  display_title: string;
  event: string;
  status: string;
  conclusion: string | null;
}

export interface ReleaseJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}

export const listReleaseRuns = async (ctx: Context) =>
  (
    await ghJson<{ workflow_runs: ReleaseRun[] }>(ctx, [
      "api",
      `repos/{owner}/{repo}/actions/workflows/${RELEASE_WORKFLOW}/runs?per_page=${WORKFLOW_RUN_LIMIT}`,
    ])
  ).workflow_runs;

export const getReleaseRun = (ctx: Context, id: string) =>
  ghJson<ReleaseRun>(ctx, ["api", `repos/{owner}/{repo}/actions/runs/${encodeURIComponent(id)}`]);

export const listReleaseJobs = async (ctx: Context, run: ReleaseRun) =>
  (
    await gh(ctx, [
      "api",
      "--paginate",
      `repos/{owner}/{repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
      "--jq",
      ".jobs[]",
    ])
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReleaseJob);

// Main pushes can resume an unpublished release as well as update the version PR.
export const releaseSelection = (run: ReleaseRun, jobs: ReleaseJob[]) => {
  if (run.path !== `.github/workflows/${RELEASE_WORKFLOW}`)
    return {
      eligible: false,
      reason: `This run's workflow is ${run.path}; release health collects ${RELEASE_WORKFLOW}.`,
    };
  if (
    jobs.some(
      (job) => /^(release_build|production \/|production_unchanged \/)/.test(job.name) && job.conclusion !== "skipped",
    )
  )
    return { eligible: true, reason: "Release build or production validation is present." };
  if (run.event !== "push" && jobs.some((job) => job.name === "plan" && job.conclusion !== "skipped"))
    return { eligible: true, reason: "A manual or scheduled release reached planning." };
  return {
    eligible: false,
    reason:
      run.event === "push"
        ? "This push has no release build or production validation."
        : "No release plan, build or production validation is present.",
  };
};
