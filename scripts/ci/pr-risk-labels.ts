export interface PullRequest {
  state: string;
  user: { login: string };
  head: { sha: string; ref: string; repo: { full_name: string } | null };
  base: { sha: string; ref: string; repo: { full_name: string } };
  changed_files: number;
  labels: Array<{ name: string }>;
}

export interface Status {
  state: "pending" | "success" | "failure" | "error";
  description: string;
}

interface PolicyApi {
  readPull: () => Promise<PullRequest>;
  publish: (sha: string, status: Status) => Promise<unknown>;
  readChangedFiles: () => Promise<Array<{ filename: string; status: string }>>;
  readManifest: (path: string, ref: string) => Promise<Record<string, unknown>>;
  readMergeBase: (base: string, head: string) => Promise<string>;
}

interface Snapshot {
  head: string;
  base: string;
  baseRef: string;
}

const snapshotOf = (pull: PullRequest) => ({ head: pull.head.sha, base: pull.base.sha, baseRef: pull.base.ref });

const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const releaseVersion = /^(?:\^|~)?\d+\.\d+\.\d+(?:-[\w.-]+)?$/;

const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const isVersionUpdate = (before: Record<string, unknown>, after: Record<string, unknown>) => {
  const previous = { ...before };
  const next = { ...after };
  if (typeof next.version !== "string" || !releaseVersion.test(next.version)) return false;
  delete previous.version;
  delete next.version;
  for (const field of dependencyFields) {
    const oldDependencies = previous[field];
    const newDependencies = next[field];
    if (sameValue(oldDependencies, newDependencies)) continue;
    if (
      !oldDependencies ||
      !newDependencies ||
      typeof oldDependencies !== "object" ||
      typeof newDependencies !== "object"
    )
      return false;
    const oldRanges = oldDependencies as Record<string, unknown>;
    const newRanges = newDependencies as Record<string, unknown>;
    if (!sameValue(Object.keys(oldRanges).sort(), Object.keys(newRanges).sort())) return false;
    for (const [name, range] of Object.entries(newRanges)) {
      if (range !== oldRanges[name] && (typeof range !== "string" || !releaseVersion.test(range))) return false;
    }
    delete previous[field];
    delete next[field];
  }
  return sameValue(previous, next);
};

// The fixed release group versions SDK and extensions together. Only release
// metadata is exempt; implementation and package entry/script changes stay blocked.
const isReleaseMetadata = async (api: PolicyApi, pull: PullRequest) => {
  if (
    pull.user.login !== "github-actions[bot]" ||
    pull.base.ref !== "main" ||
    pull.head.ref !== "changeset-release/main" ||
    pull.head.repo?.full_name !== pull.base.repo.full_name
  )
    return false;
  const files = await api.readChangedFiles();
  if (files.length !== pull.changed_files || files.length === 0)
    throw new Error("Incomplete release diff; rerun classification");
  const mergeBase = await api.readMergeBase(pull.base.sha, pull.head.sha);
  for (const file of files) {
    if (file.filename === "bun.lock" && file.status === "modified") continue;
    if (/^\.changeset\/[^/]+\.md$/.test(file.filename) && file.status === "removed") continue;
    if (
      /^(packages|extensions|clients)\/[^/]+\/CHANGELOG\.md$/.test(file.filename) &&
      ["added", "modified"].includes(file.status)
    )
      continue;
    if (!/^(packages|extensions|clients)\/[^/]+\/package\.json$/.test(file.filename) || file.status !== "modified")
      return false;
    const [before, after] = await Promise.all([
      api.readManifest(file.filename, mergeBase),
      api.readManifest(file.filename, pull.head.sha),
    ]);
    if (!isVersionUpdate(before, after)) return false;
  }
  return true;
};

export async function prepare(api: PolicyApi) {
  const pull = await api.readPull();
  const snapshot = snapshotOf(pull);
  await api.publish(snapshot.head, { state: "pending", description: "Synchronizing PR area labels" });
  try {
    if (pull.state !== "open") throw new Error("The pull request is no longer open");
    // GitHub's files API stops at 3,000. A partial diff cannot prove separation.
    if (pull.changed_files > 3000) throw new Error("The PR exceeds GitHub's 3,000-file classification limit");
    // Leave room for all seven managed labels without the labeler's truncation.
    if (pull.labels.length > 93) throw new Error("Remove labels to leave room for the seven area labels");
    return snapshot;
  } catch (error) {
    await api.publish(snapshot.head, { state: "error", description: String(error).slice(0, 140) });
    throw error;
  }
}

export async function finish(
  api: PolicyApi,
  snapshot: Snapshot,
  outcome: string,
  synchronizedLabels: string | undefined,
) {
  let status: Status;
  try {
    if (outcome !== "success") throw new Error("Label synchronization failed; rerun the workflow");
    if (synchronizedLabels === undefined) throw new Error("Labeler skipped classification; rerun the workflow");
    const current = await api.readPull();
    if (current.labels.length >= 100) throw new Error("GitHub's label limit was reached; remove labels and rerun");
    const next = snapshotOf(current);
    if (
      current.state !== "open" ||
      next.head !== snapshot.head ||
      next.base !== snapshot.base ||
      next.baseRef !== snapshot.baseRef
    ) {
      throw new Error("PR head or base changed during classification; rerun the workflow");
    }
    const labels = new Set(synchronizedLabels.split(","));
    const currentLabels = new Set(current.labels.map((label) => label.name));
    for (const label of ["sdk", "extensions"]) {
      if (labels.has(label) !== currentLabels.has(label)) {
        throw new Error("Area labels changed during classification; rerun the workflow");
      }
    }
    status = { state: "success", description: "SDK and extension changes are separate" };
    if (labels.has("sdk") && labels.has("extensions")) {
      status = (await isReleaseMetadata(api, current))
        ? {
            state: "success",
            description: "Generated release metadata contains no SDK or extension implementation changes",
          }
        : { state: "failure", description: "Split SDK and extension changes into separate PRs" };
      const latest = await api.readPull();
      if (latest.state !== "open" || !sameValue(snapshotOf(latest), snapshot))
        throw new Error("PR head or base changed during classification; rerun the workflow");
    }
  } catch (error) {
    status = { state: "error", description: String(error).slice(0, 140) };
  }
  // Always publish to the head captured before classification, never a newer head.
  await api.publish(snapshot.head, status);
  return status;
}

interface ApiOptions {
  apiUrl: string;
  repository: string;
  token: string;
  pullNumber: number;
  runUrl: string;
}

export function createApi(options: ApiOptions) {
  const { apiUrl, repository, token, pullNumber, runUrl } = options;
  if (!Number.isSafeInteger(pullNumber) || pullNumber <= 0) throw new Error("A positive PR number is required");
  async function request(path: string, body?: object) {
    const response = await fetch(`${apiUrl}/repos/${repository}/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub ${response.status} for ${path}`);
    return response.json();
  }
  return {
    readPull: async () => (await request(`pulls/${pullNumber}`)) as PullRequest,
    readMergeBase: async (base: string, head: string) => {
      const comparison = await request(`compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
      return comparison.merge_base_commit.sha as string;
    },
    readChangedFiles: async () => {
      const files: Array<{ filename: string; status: string }> = [];
      for (let page = 1; page <= 30; page++) {
        const batch = await request(`pulls/${pullNumber}/files?per_page=100&page=${page}`);
        files.push(...batch);
        if (batch.length < 100) break;
      }
      return files;
    },
    readManifest: async (path: string, ref: string) => {
      const file = await request(
        `contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
      );
      if (file.encoding !== "base64") throw new Error(`Cannot read release manifest: ${path}`);
      return JSON.parse(Buffer.from(file.content, "base64").toString("utf8")) as Record<string, unknown>;
    },
    publish: (sha: string, status: Status) =>
      request(`statuses/${sha}`, { ...status, context: "sdk-extension-separation", target_url: runUrl }),
  };
}
