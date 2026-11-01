import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { platformLabel, SUITES } from "./platforms";

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
export const finished = (status: RunStatus) => status === "succeeded" || status === "failed" || status === "cancelled";

export interface RunCommit {
  ref: string;
  // Known once results arrive, or when the ref is itself a SHA or was resolved when the run started.
  sha?: string;
}
export interface WorkflowRun {
  id: string;
  title: string;
  status: RunStatus;
  commits: RunCommit[];
  platforms: string[];
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
  const result = await ctx.process.run({ command: ["gh", ...args] }).catch((error: unknown) => {
    // Only a missing executable means gh is not installed; other failures keep their own message.
    if (/ENOENT|not found/i.test(String(error))) throw new Error(GH_MISSING_MESSAGE);
    throw error;
  });
  if (result.exitCode !== 0) {
    if (/auth login|not logged/i.test(result.stderr)) throw new Error(GH_MISSING_MESSAGE);
    throw new Error(result.stderr.trim() || `gh ${args[0]} failed with exit code ${result.exitCode}.`);
  }
  return result.stdout;
};

const ghJson = async <T>(ctx: Context, args: string[]) => JSON.parse(await gh(ctx, args)) as T;

// GitHub pages lists at 30 by default; every page is read, one JSON value per line.
const ghPages = async <T>(ctx: Context, path: string, jq: string) =>
  (await gh(ctx, ["api", "--paginate", path, "--jq", jq]))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

export const runStatus = (status: string, conclusion: string | null): RunStatus => {
  if (status === "queued" || status === "waiting" || status === "pending" || status === "requested") return "queued";
  if (status !== "completed") return "running";
  if (conclusion === "success") return "succeeded";
  if (conclusion === "cancelled") return "cancelled";
  return "failed";
};

const SHA = /^[0-9a-f]{7,40}$/;

// benchmarks.yml names each run "Benchmarks <commits or release tag> on <platforms>", so runs started
// anywhere carry what they measure.
export const parseRunTitle = (title: string) => {
  const match = title.match(/^Benchmarks (.+) on (.+)$/);
  if (!match) return { commits: [], platforms: [] };
  const split = (list: string) => list.split(",").flatMap((entry) => (entry.trim() ? [entry.trim()] : []));
  return {
    commits: split(match[1]).map((ref): RunCommit => (SHA.test(ref) ? { ref, sha: ref } : { ref })),
    platforms: split(match[2]),
  };
};

interface ApiRelease {
  tag_name: string;
  published_at: string | null;
  draft: boolean;
  assets: { id: number; name: string }[];
}
export const listReleases = async (ctx: Context) => {
  const releases = await ghPages<ApiRelease>(ctx, "repos/{owner}/{repo}/releases?per_page=100", ".[]");
  return releases
    .filter((release) => !release.draft && release.published_at)
    .map((release) => ({
      tag: release.tag_name,
      publishedAt: release.published_at ?? "",
      assets: release.assets.map((asset) => ({ id: asset.id, name: asset.name })),
    }));
};

interface ApiTagRefs {
  data: {
    repository: {
      refs: { nodes: { name: string; target: { oid: string; target?: { oid: string } } }[] };
    };
  };
}
const TAG_QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    refs(refPrefix: "refs/tags/", query: "pstdio@", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
      nodes { name target { oid ... on Tag { target { oid } } } }
    }
  }
}`;

// GitHub's tags are what CI checks out. A local clone can hold a tag that was moved since it was fetched.
export const listTagCommits = async (ctx: Context) => {
  const { data } = await ghJson<ApiTagRefs>(ctx, [
    "api",
    "graphql",
    "-F",
    "owner={owner}",
    "-F",
    "name={repo}",
    "-f",
    `query=${TAG_QUERY}`,
  ]);
  // Annotated tags point at a tag object, so the commit it peels to wins.
  return new Map(data.repository.refs.nodes.map((node) => [node.name, node.target.target?.oid ?? node.target.oid]));
};

// The commit GitHub holds for a pushed branch, tag, or SHA: the one a run checks out.
export const resolveCommit = async (ctx: Context, ref: string) =>
  (await gh(ctx, ["api", `repos/{owner}/{repo}/commits/${ref}`, "--jq", ".sha"]).catch(() => "")).trim() || undefined;

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
      ...parseRunTitle(run.displayTitle),
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
}
const runTitle = (input: StartRunInput) => `Benchmarks ${input.commits.join(",")} on ${input.platforms.join(",")}`;
const DISPATCH_LOOKUPS = 5;

// CI runs each benchmark once, so the workflow's samples input keeps its default of 1.
export const startRun = async (ctx: Context, input: StartRunInput) => {
  // Runs that existed before this dispatch, so an identical run started by someone else is not taken for it.
  const earlier = new Set((await listRuns(ctx)).map((run) => run.id));
  const dispatchedAt = Date.now();
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
  ]);
  const printed = output.match(/actions\/runs\/(\d+)/)?.[1];
  if (printed) return printed;
  // Some gh versions print no run URL, so the run is found by its title among the newest runs.
  for (let attempt = 0; attempt < DISPATCH_LOOKUPS; attempt++) {
    const run = (await listRuns(ctx)).find(
      (entry) =>
        !earlier.has(entry.id) &&
        entry.title === runTitle(input) &&
        Date.parse(entry.createdAt) >= dispatchedAt - 60_000,
    );
    if (run) return run.id;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return undefined;
};

export const cancelRun = (ctx: Context, runId: string) => gh(ctx, ["run", "cancel", runId]);

// A release run uploads one artifact per platform and suite, more than one page holds.
export const listRunArtifacts = (ctx: Context, runId: string) =>
  ghPages<RunArtifact>(
    ctx,
    `repos/{owner}/{repo}/actions/runs/${runId}/artifacts?per_page=100`,
    ".artifacts[] | {id, name, expired}",
  );

// Artifacts download as zip archives, so gh unpacks them into a folder the caller reads.
export const downloadRunArtifact = (ctx: Context, runId: string, name: string, dir: string) =>
  gh(ctx, ["run", "download", runId, "--name", name, "--dir", dir]);

interface ApiRunView {
  status: string;
  conclusion: string | null;
  jobs: {
    name: string;
    status: string;
    conclusion: string | null;
    steps: { name: string; status: string; conclusion: string | null }[];
  }[];
}
const JOB_OUTCOMES: Record<string, string> = { success: "finished", failure: "failed", cancelled: "stopped" };

// Benchmark jobs are named "<platform> · <suite>". The status tooltip names each suite's outcome, and the
// platform too when the run covers several.
export const jobsDetail = (jobs: ApiRunView["jobs"]) => {
  const suites = jobs.flatMap((job) => {
    const [platform, suite] = job.name.split(" · ");
    return suite ? [{ platform, suite, job }] : [];
  });
  const several = new Set(suites.map((entry) => entry.platform)).size > 1;
  return suites
    .map(({ platform, suite, job }) => {
      const label = SUITES.find((entry) => entry.id === suite)?.label ?? suite;
      const name = several ? `${platformLabel(platform)} · ${label}` : label;
      if (job.status !== "completed") return `${name} ${job.status === "in_progress" ? "running" : "queued"}`;
      return `${name} ${JOB_OUTCOMES[job.conclusion ?? ""] ?? job.conclusion ?? "finished"}`;
    })
    .join("\n");
};

// Progress counts finished steps across every platform job, so it moves while benchmarks run.
export const runProgress = async (ctx: Context, runId: string) => {
  const view = await ghJson<ApiRunView>(ctx, ["run", "view", runId, "--json", "status,conclusion,jobs"]);
  const steps = view.jobs.flatMap((job) => job.steps);
  const failedJob = view.jobs.find((job) => job.conclusion === "failure");
  const failedStep = failedJob?.steps.find((step) => step.conclusion === "failure");
  return {
    status: runStatus(view.status, view.conclusion),
    progress: steps.length ? steps.filter((step) => step.status === "completed").length / steps.length : 0,
    detail: jobsDetail(view.jobs),
    // Undefined clears an earlier failure once a re-run passes.
    failure: failedJob ? `${failedJob.name}: ${failedStep?.name ?? "failed"}` : undefined,
  };
};
