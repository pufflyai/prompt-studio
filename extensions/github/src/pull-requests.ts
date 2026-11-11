import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
export interface PullRequestIdentity {
  id: string;
  host: string;
  repository: string;
  number: number;
}
export interface PullRequestEvidence {
  headRefOid: string;
  baseRefName: string;
  state: string;
  mergeable: string;
  mergeCommit?: { oid: string } | null;
  statusCheckRollup?: { status?: string; conclusion?: string; state?: string }[];
}
export type PullRequestRead = { id: string } & (PullRequestEvidence | { error: string });
type Context = Pick<ExtensionContextBase, "storage" | "process" | "projectId">;
export const parsePullRequest = (url: string) => {
  try {
    const value = new URL(url);
    const match = /^\/([^/]+)\/([^/]+)\/pull\/([1-9]\d*)(?:\/.*)?$/.exec(value.pathname);
    if (
      value.protocol !== "https:" ||
      value.username ||
      value.password ||
      value.port ||
      !match ||
      !/^[a-z0-9][a-z0-9-]*$/i.test(match[1]!) ||
      !/^[a-z0-9._-]+$/i.test(match[2]!)
    )
      return null;
    const host = value.hostname.toLowerCase();
    const repository = `${match[1]}/${match[2]}`.toLowerCase();
    const number = Number(match[3]);
    if (!Number.isSafeInteger(number)) return null;
    return { id: `https://${host}/${repository}/pull/${number}`, host, repository, number };
  } catch {
    return null;
  }
};
export const pullRequestResource = (pr: PullRequestIdentity, projectId: string) => ({
  type: "pull-request",
  id: pr.id,
  extensionId: "pstdio.github",
  projectId,
  label: `${pr.repository} #${pr.number}`,
  icon: "git-pull-request",
});
export const importPullRequest = async (ctx: Context, url: string) => {
  const identity = parsePullRequest(url);
  if (!identity) throw new Error("Use a GitHub pull request URL.");
  await ctx.storage.collection<PullRequestIdentity>("pull-requests").put(identity.id, identity);
  return pullRequestResource(identity, ctx.projectId);
};
// Coalesce concurrent reads only. Saved identity never supplies delivery evidence.
const pending = new Map<string, Promise<PullRequestRead>>();
const readPullRequest = (ctx: Context, id: string) => {
  const key = `${ctx.projectId}:${id}`;
  const current = pending.get(key);
  if (current) return current;
  const read = (async (): Promise<PullRequestRead> => {
    try {
      const identity = parsePullRequest(id);
      if (!identity || identity.id !== id) throw new Error("Invalid pull request identity.");
      const result = await ctx.process.run({
        command: [
          "gh",
          "pr",
          "view",
          id,
          "--json",
          "headRefOid,baseRefName,mergeable,statusCheckRollup,state,mergeCommit",
        ],
      });
      if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "GitHub is unavailable.");
      const value = JSON.parse(result.stdout) as PullRequestEvidence;
      if (!value.headRefOid || !value.state || !value.baseRefName)
        throw new Error("GitHub returned incomplete pull request evidence.");
      return { ...value, id };
    } catch (error) {
      return { id, error: String(error) };
    }
  })();
  pending.set(key, read);
  void read.finally(() => {
    if (pending.get(key) === read) pending.delete(key);
  });
  return read;
};
export const readPullRequests = async (ctx: Context, ids: string[]) => {
  if (ids.length > 100) throw new Error("Read at most 100 pull requests.");
  const unique = [...new Set(ids)];
  const results: PullRequestRead[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, unique.length) }, async () => {
      while (next < unique.length) results.push(await readPullRequest(ctx, unique[next++]!));
    }),
  );
  return results;
};
