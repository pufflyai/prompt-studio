interface GateOptions {
  apiUrl: string;
  repository: string;
  token: string;
  pullNumber: number;
  runUrl: string;
}

const releaseBranch = "changeset-release/main";

export const initializeReleaseReadiness = async (options: GateOptions) => {
  const { apiUrl, repository, token, pullNumber, runUrl } = options;
  if (!Number.isSafeInteger(pullNumber) || pullNumber <= 0) throw new Error("A positive PR number is required");
  const request = async (path: string, body?: object) => {
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
    if (response.status === 404 && path === `git/ref/heads/${releaseBranch}`) return null;
    if (!response.ok) throw new Error(`GitHub ${response.status} for ${path}`);
    return response.json();
  };
  const pull = await request(`pulls/${pullNumber}`);
  if (pull.state !== "open") throw new Error("The pull request is no longer open");
  const reserved = { description: "The release rehearsal owns this commit's required status" };
  if (pull.head.ref === releaseBranch) return reserved;
  const releaseRef = await request(`git/ref/heads/${releaseBranch}`);
  // Statuses belong to commits, not PRs. A copy of the candidate must not approve it.
  if (releaseRef?.object.sha === pull.head.sha) return reserved;
  await request(`statuses/${pull.head.sha}`, {
    state: "success",
    context: "release-readiness",
    description: "This PR does not require a release rehearsal",
    target_url: runUrl,
  });
  return { description: "This PR does not require a release rehearsal" };
};
