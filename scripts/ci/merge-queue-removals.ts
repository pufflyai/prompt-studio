// Loaded from the trusted base commit by .github/workflows/merge-queue-removals.yml after its
// types are stripped, so this file has no runtime imports.

export const REMOVED_LABEL = "removed-from-queue";

export type QueueEvent = { kind: "added"; at: string } | { kind: "removed"; at: string; reason: string };

export interface PullQueueState {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  labels: string[];
  events: QueueEvent[];
}

export interface FailedRun {
  url: string;
  jobs: string[];
}

export interface QueueApi {
  readPull: (number: number) => Promise<PullQueueState>;
  readFailedRun: (number: number, before: string) => Promise<FailedRun | null>;
  addLabel: (number: number) => Promise<void>;
  removeLabel: (number: number) => Promise<void>;
  comment: (number: number, body: string) => Promise<void>;
}

const reasons: Record<string, string> = {
  failed_checks: "a required check failed in its merge group",
  merge_conflict: "it conflicts with the pull requests ahead of it",
  manual: "someone removed it",
};

// GitHub records a merge as a removal too. Only the newest queue event counts: a later
// enqueue answers an earlier removal.
const currentRemoval = (pull: PullQueueState) => {
  if (pull.state !== "OPEN") return null;
  const latest = [...pull.events].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return latest?.kind === "removed" && latest.reason !== "merged" ? latest : null;
};

const removalComment = (removal: { at: string; reason: string }, run: FailedRun | null) => {
  const lines = [
    `GitHub removed this pull request from the merge queue at ${removal.at}: ${reasons[removal.reason] ?? removal.reason}.`,
  ];
  if (run) lines.push("", `Failed merge group run: ${run.url}`, ...run.jobs.map((job) => `- ${job}`));
  lines.push(
    "",
    "Fix the cause, then add the pull request to the queue again. If this pull request did not cause the failure, the check is not deterministic: fix or quarantine the check first.",
  );
  return lines.join("\n");
};

const reconcile = async (api: QueueApi, pull: PullQueueState) => {
  const removal = currentRemoval(pull);
  const labelled = pull.labels.includes(REMOVED_LABEL);
  // The label marks a reported removal, so each removal is commented on once.
  if (removal && !labelled) {
    const run = removal.reason === "failed_checks" ? await api.readFailedRun(pull.number, removal.at) : null;
    await api.comment(pull.number, removalComment(removal, run));
    await api.addLabel(pull.number);
  }
  if (!removal && labelled) await api.removeLabel(pull.number);
};

export const reconcilePull = async (api: QueueApi, number: number) => reconcile(api, await api.readPull(number));

const pullFields = `number state labels(first: 100) { nodes { name } }
  timelineItems(last: 20, itemTypes: [ADDED_TO_MERGE_QUEUE_EVENT, REMOVED_FROM_MERGE_QUEUE_EVENT]) {
    nodes { __typename ... on AddedToMergeQueueEvent { createdAt } ... on RemovedFromMergeQueueEvent { createdAt reason } }
  }`;

interface PullNode {
  number: number;
  state: PullQueueState["state"];
  labels: { nodes: Array<{ name: string }> };
  timelineItems: { nodes: Array<{ __typename: string; createdAt: string; reason?: string }> };
}

const toState = (node: PullNode): PullQueueState => ({
  number: node.number,
  state: node.state,
  labels: node.labels.nodes.map((label) => label.name),
  events: node.timelineItems.nodes.map((event) =>
    event.__typename === "AddedToMergeQueueEvent"
      ? { kind: "added", at: event.createdAt }
      : { kind: "removed", at: event.createdAt, reason: (event.reason ?? "").toLowerCase() },
  ),
});

export const createApi = (options: { apiUrl: string; graphqlUrl: string; repository: string; token: string }) => {
  const { apiUrl, graphqlUrl, repository, token } = options;
  const [owner, name] = repository.split("/");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const rest = async (path: string, init: { method?: string; body?: object } = {}) => {
    const response = await fetch(`${apiUrl}/repos/${repository}/${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers,
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
    if (!response.ok && !(init.method === "DELETE" && response.status === 404)) {
      throw new Error(`GitHub ${response.status} for ${path}`);
    }
    return response.status === 204 ? null : response.json();
  };
  const graphql = async (query: string, variables: Record<string, unknown>) => {
    const response = await fetch(graphqlUrl, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
    const result = await response.json();
    if (!response.ok || result.errors)
      throw new Error(`GitHub GraphQL failed: ${JSON.stringify(result.errors ?? response.status)}`);
    return result.data;
  };
  return {
    readPull: async (number) => {
      const data = await graphql(
        `query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { ${pullFields} } } }`,
        { owner, name, number },
      );
      return toState(data.repository.pullRequest);
    },
    readFailedRun: async (number, before) => {
      const { workflow_runs: runs } = await rest("actions/runs?event=merge_group&status=failure&per_page=100");
      // Queue branches are named gh-readonly-queue/<base>/pr-<number>-<base sha>.
      const run = runs.find(
        (candidate: { head_branch: string; created_at: string }) =>
          candidate.head_branch.startsWith("gh-readonly-queue/") &&
          candidate.head_branch.includes(`/pr-${number}-`) &&
          candidate.created_at <= before,
      );
      if (!run) return null;
      const { jobs } = await rest(`actions/runs/${run.id}/jobs?per_page=100&filter=latest`);
      return {
        url: run.html_url,
        jobs: jobs
          .filter(
            (job: { conclusion: string; name: string }) => job.conclusion === "failure" && job.name !== "ci_passed",
          )
          .map((job: { name: string }) => job.name),
      };
    },
    addLabel: async (number) => {
      await rest(`issues/${number}/labels`, { body: { labels: [REMOVED_LABEL] } });
    },
    removeLabel: async (number) => {
      await rest(`issues/${number}/labels/${encodeURIComponent(REMOVED_LABEL)}`, { method: "DELETE" });
    },
    comment: async (number, body) => {
      await rest(`issues/${number}/comments`, { body: { body } });
    },
  } satisfies QueueApi;
};
