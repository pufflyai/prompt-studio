import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

// Results and runs live on GitHub. The developer's own `gh` login reads and starts them.
export const BENCHMARK_WORKFLOW = "benchmarks.yml";

type Context = Pick<ExtensionContextBase, "process">;

export interface ReleaseAsset {
  id: number;
  name: string;
}
export interface Release {
  tag: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export interface WorkflowRun {
  id: string;
  title: string;
  status: RunStatus;
  url: string;
  createdAt: string;
  updatedAt: string;
}
export interface RunArtifact {
  id: number;
  name: string;
  expired: boolean;
}

export const GH_MISSING_MESSAGE =
  "GitHub CLI is not available or not signed in. Install gh and run `gh auth login` in this project.";

const gh = async (ctx: Context, args: string[]) => {
  const result = await ctx.process.run({ command: ["gh", ...args] }).catch(() => undefined);
  if (!result) throw new Error(GH_MISSING_MESSAGE);
  if (result.exitCode !== 0) {
    if (/auth login|not logged/i.test(result.stderr)) throw new Error(GH_MISSING_MESSAGE);
    throw new Error(result.stderr.trim() || `gh ${args[0]} failed with exit code ${result.exitCode}.`);
  }
  return result.stdout;
};

const ghJson = async <T>(ctx: Context, args: string[]) => JSON.parse(await gh(ctx, args)) as T;

export const runStatus = (status: string, conclusion: string | null): RunStatus => {
  if (status === "queued" || status === "waiting" || status === "pending" || status === "requested") return "queued";
  if (status !== "completed") return "running";
  if (conclusion === "success") return "succeeded";
  if (conclusion === "cancelled") return "cancelled";
  return "failed";
};

interface ApiRelease {
  tag_name: string;
  published_at: string | null;
  draft: boolean;
  assets: { id: number; name: string }[];
}
export const listReleases = async (ctx: Context) => {
  const releases = await ghJson<ApiRelease[]>(ctx, ["api", "repos/{owner}/{repo}/releases?per_page=100"]);
  return releases
    .filter((release) => !release.draft && release.published_at)
    .map((release) => ({
      tag: release.tag_name,
      publishedAt: release.published_at ?? "",
      assets: release.assets.map((asset) => ({ id: asset.id, name: asset.name })),
    }));
};

export const downloadReleaseAsset = (ctx: Context, assetId: number) =>
  gh(ctx, ["api", `repos/{owner}/{repo}/releases/assets/${assetId}`, "-H", "Accept: application/octet-stream"]);

interface ApiRun {
  databaseId: number;
  displayTitle: string;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}
export const listRuns = async (ctx: Context) => {
  const runs = await ghJson<ApiRun[]>(ctx, [
    "run",
    "list",
    "--workflow",
    BENCHMARK_WORKFLOW,
    "--limit",
    "50",
    "--json",
    "databaseId,displayTitle,status,conclusion,url,createdAt,updatedAt",
  ]);
  return runs.map(
    (run): WorkflowRun => ({
      id: String(run.databaseId),
      title: run.displayTitle,
      status: runStatus(run.status, run.conclusion),
      url: run.url,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }),
  );
};

export interface StartRunInput {
  commits: string[];
  suites: string[];
  platforms: string[];
  samples: number;
}
export const startRun = async (ctx: Context, input: StartRunInput) => {
  const output = await gh(ctx, [
    "workflow",
    "run",
    BENCHMARK_WORKFLOW,
    "-f",
    `commits=${input.commits.join(",")}`,
    "-f",
    `suites=${input.suites.join(",")}`,
    "-f",
    `platforms=${input.platforms.join(",")}`,
    "-f",
    `samples=${input.samples}`,
  ]);
  return output.match(/actions\/runs\/(\d+)/)?.[1];
};

export const cancelRun = (ctx: Context, runId: string) => gh(ctx, ["run", "cancel", runId]);

interface ApiArtifacts {
  artifacts: { id: number; name: string; expired: boolean }[];
}
export const listRunArtifacts = async (ctx: Context, runId: string) => {
  const { artifacts } = await ghJson<ApiArtifacts>(ctx, ["api", `repos/{owner}/{repo}/actions/runs/${runId}/artifacts`]);
  return artifacts.map((artifact): RunArtifact => ({ ...artifact }));
};

// Artifacts download as zip archives, so gh unpacks them into a folder the caller reads.
export const downloadRunArtifact = (ctx: Context, runId: string, name: string, dir: string) =>
  gh(ctx, ["run", "download", runId, "--name", name, "--dir", dir]);

interface ApiRunView {
  status: string;
  conclusion: string | null;
  jobs: { name: string; conclusion: string | null; steps: { name: string; status: string; conclusion: string | null }[] }[];
}
// Progress counts finished steps across every platform job, so it moves while samples run.
export const runProgress = async (ctx: Context, runId: string) => {
  const view = await ghJson<ApiRunView>(ctx, ["run", "view", runId, "--json", "status,conclusion,jobs"]);
  const steps = view.jobs.flatMap((job) => job.steps);
  const failedJob = view.jobs.find((job) => job.conclusion === "failure");
  const failedStep = failedJob?.steps.find((step) => step.conclusion === "failure");
  return {
    status: runStatus(view.status, view.conclusion),
    progress: steps.length ? steps.filter((step) => step.status === "completed").length / steps.length : 0,
    ...(failedJob ? { failure: `${failedJob.name}: ${failedStep?.name ?? "failed"}` } : {}),
  };
};
