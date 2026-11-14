import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// Hash executable workload source, not formatting/comments. Product implementation repairs
// outside these owners keep the same workload series. Harness repairs can retain revision 1.
export const workloadSource = (file: string) =>
  file.startsWith("packages/benchmarks/src/") ||
  /^scripts\/ci\/(.*benchmark.*|production-performance.*|production-platforms)\.ts$/.test(file) ||
  /^\.github\/workflows\/(benchmarks|benchmark-catalog|production-performance|production-desktop|verify-windows-signing|source-benchmarks)\.yml$/.test(
    file,
  ) ||
  file.startsWith("packages/e2e/src/perf/critical/") ||
  /^packages\/e2e\/src\/(packaged|helpers)\/.*(helpers|source|folder-project)\.ts$/.test(file) ||
  /^packages\/e2e\/src\/perf\/desktop-memory-(app|samples)\.ts$/.test(file) ||
  file.startsWith("packages/storage-scale-fixture/") ||
  file.startsWith("packages/workbench-fixture/") ||
  /scripts\/dev\/(seed-planner-stress|planner-stress-data)\.ts$/.test(file) ||
  /packages\/pstdio-db\/src\/services\/extension-storage\/(critical-store\.p3\.bench|database-scale-fixture)\.ts$/.test(
    file,
  ) ||
  file === "packages/e2e/src/local-workspace-registry.ts" ||
  file === "packages/pstdio-api/src/benchmark-counters.ts";

export const normalizedSource = (file: string, source: string) => {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (!/\.[cm]?tsx?$/.test(file)) return source.trim();
  return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(parsed);
};
export const sourceDigest = (entries: [string, string][]) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        entries.sort(([a], [b]) => a.localeCompare(b)).map(([file, source]) => [file, normalizedSource(file, source)]),
      ),
    )
    .digest("hex");
export const catalogDigest = (root: string) => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => workloadSource(file) && existsSync(join(root, file)));
  return sourceDigest(files.map((file) => [file, readFileSync(join(root, file), "utf8")]));
};

export const approvalEnvironment = "benchmark-catalog";
export const readContract = (root: string) => {
  const lock = JSON.parse(readFileSync(join(root, "packages/benchmarks/catalog.lock.json"), "utf8")) as {
    revision: number;
    digest: string;
    authorization: string;
  };
  if (lock.revision !== 1 || lock.digest !== catalogDigest(root))
    throw new Error("Frozen workload source changed; explicit human authorization and protected review are required");
  return lock;
};

// The receipt is external to the candidate. Only an actual environment review on a
// completed workflow run can approve the immutable commit containing the lock.
export const approvedCatalog = async (digest: string) => {
  const repository = process.env.GITHUB_REPOSITORY ?? "pufflyai/prompt-studio";
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const request = async (path: string) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error(`Cannot read external benchmark approval: HTTP ${response.status}`);
    return response.json();
  };
  const deployments = await request(`deployments?environment=${approvalEnvironment}&per_page=100`);
  for (const deployment of deployments) {
    if (
      deployment.payload?.catalogDigest !== digest ||
      deployment.creator?.login !== "github-actions[bot]" ||
      !deployment.payload.runId
    )
      continue;
    const run = await request(`actions/runs/${deployment.payload.runId}`);
    if (
      run.path !== ".github/workflows/benchmarks.yml" ||
      run.event !== "workflow_dispatch" ||
      run.conclusion !== "success" ||
      run.head_sha !== deployment.sha
    )
      continue;
    const statuses = await request(`deployments/${deployment.id}/statuses`);
    if (statuses[0]?.state !== "success") continue;
    const reviews = await request(`actions/runs/${run.id}/approvals`);
    if (
      !reviews.some(
        (review: { state: string; user: { type: string }; environments: { name: string }[] }) =>
          review.state === "approved" &&
          review.user.type === "User" &&
          review.environments.some((environment) => environment.name === approvalEnvironment),
      )
    )
      continue;
    const file = await request(`contents/packages/benchmarks/catalog.lock.json?ref=${run.head_sha}`);
    const accepted = JSON.parse(Buffer.from(file.content, "base64").toString());
    if (accepted.revision === 1 && accepted.digest === digest)
      return { runId: run.id, sha: run.head_sha, url: run.html_url };
  }
  throw new Error(
    `Catalog revision 1 (${digest}) has no retained human approval in the protected ${approvalEnvironment} environment. Agents must never approve their own request. A self-edited lock is not approval.`,
  );
};
