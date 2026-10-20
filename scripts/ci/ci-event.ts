interface CiEvent {
  merge_group?: { base_sha: string; head_sha?: string; base_ref?: string };
  pull_request?: { labels: Array<{ name: string }> };
}

interface QueuePull {
  number: number;
  changedFiles: number;
  labels: { nodes: Array<{ name: string }>; pageInfo: { hasNextPage: boolean } };
}

interface QueueEntry<T> {
  headCommit: { oid: string } | null;
  pullRequest: T;
}

export const ciBase = (event: string, payload: CiEvent) => {
  if (event !== "merge_group") return "HEAD~1";
  const base = payload.merge_group?.base_sha;
  if (!base || !/^[a-f0-9]{40}$/.test(base)) throw new Error("The merge group must provide its full base SHA");
  return base;
};

export const selectQueuePulls = <T>(entries: QueueEntry<T>[], commits: Set<string>, head: string) => {
  if (!entries.some((entry) => entry.headCommit?.oid === head)) {
    throw new Error("The merge group is no longer in the queue; cannot establish its required checks");
  }
  return entries
    .filter((entry) => entry.headCommit && commits.has(entry.headCommit.oid))
    .map((entry) => entry.pullRequest);
};

const queueQuery = `query($owner: String!, $name: String!, $branch: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    mergeQueue(branch: $branch) {
      entries(first: 100, after: $after) {
        nodes { headCommit { oid } pullRequest {
          number changedFiles labels(first: 100) { nodes { name } pageInfo { hasNextPage } }
        } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

const githubJson = async (url: string, init: RequestInit) => {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (attempt === 2) throw error;
      await Bun.sleep(200 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response.json();
    if (attempt === 2 || (response.status < 500 && response.status !== 429)) {
      throw new Error(`GitHub ${response.status} while reading merge-group coverage`);
    }
    await response.body?.cancel();
    await Bun.sleep(200 * 2 ** attempt);
  }
};

export async function readQueueChanges(payload: CiEvent, commits: Set<string>) {
  const repository = process.env.GITHUB_REPOSITORY!;
  const token = process.env.GH_TOKEN!;
  const api = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const request = async (path: string, body?: object) => {
    return githubJson(`${api}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };
  const [owner, name] = repository.split("/");
  const branch = payload.merge_group!.base_ref!.replace(/^refs\/heads\//, "");
  const entries: QueueEntry<QueuePull>[] = [];
  let after: string | null = null;
  for (;;) {
    const response = await request("/graphql", { query: queueQuery, variables: { owner, name, branch, after } });
    if (response.errors) throw new Error(`Cannot read merge queue: ${JSON.stringify(response.errors)}`);
    const page = response.data?.repository?.mergeQueue?.entries;
    if (!page) throw new Error("The repository has no readable merge queue");
    entries.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  const pulls = selectQueuePulls(entries, commits, payload.merge_group!.head_sha!);
  const labels: string[] = [];
  const changedFiles = new Set<string>();
  await Promise.all(
    pulls.map(async (pull) => {
      if (pull.labels.pageInfo.hasNextPage) throw new Error(`PR #${pull.number} has an incomplete label list`);
      labels.push(...pull.labels.nodes.map((label) => label.name));
      let count = 0;
      for (let page = 1; ; page++) {
        const files = (await request(
          `/repos/${repository}/pulls/${pull.number}/files?per_page=100&page=${page}`,
        )) as Array<{ filename: string; previous_filename?: string }>;
        for (const file of files) {
          changedFiles.add(file.filename);
          if (file.previous_filename) changedFiles.add(file.previous_filename);
        }
        count += files.length;
        if (files.length < 100) break;
      }
      if (count !== pull.changedFiles) throw new Error(`PR #${pull.number} changed or its file list was truncated`);
    }),
  );
  return { labels, changedFiles: [...changedFiles] };
}
