export interface PullRequest {
  state: string;
  head: { sha: string };
  base: { sha: string; ref: string };
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
}

interface Snapshot {
  head: string;
  base: string;
  baseRef: string;
}

const snapshotOf = (pull: PullRequest) => ({ head: pull.head.sha, base: pull.base.sha, baseRef: pull.base.ref });

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
      status = { state: "failure", description: "Split SDK and extension changes into separate PRs" };
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
    publish: (sha: string, status: Status) =>
      request(`statuses/${sha}`, { ...status, context: "sdk-extension-separation", target_url: runUrl }),
  };
}
