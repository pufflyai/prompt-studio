import { commandRef, type ExtensionContextBase, type ResourceAnchor, type ResourceRef } from "@pstdio/sdk/extensions";
import { changeTicketRecord, ticketRecords } from "./ticket-records";
import type { Ticket } from "./types";

const github = commandRef.forExtension({ publisher: "pstdio", name: "github" });
const importPr = github<{ url: string }, ResourceRef>("pull-requests.import");
export interface PullRequestEvidence {
  id: string;
  headRefOid: string;
  baseRefName: string;
  state: string;
  mergeable: string;
  mergeCommit?: { oid: string } | null;
  statusCheckRollup?: { status?: string; conclusion?: string; state?: string }[];
}
export type PullRequestRead = PullRequestEvidence | { id: string; error: string };
export const findMergedGithubPrs = github<{ branches: string[] }, { branch: string; id: string }[]>(
  "pull-requests.find-merged",
);
const readPrs = github<{ ids: string[] }, PullRequestRead[]>("pull-requests.read");
type Context = Pick<ExtensionContextBase, "commands" | "resources" | "storage" | "extensionId" | "projectId">;
export const ticketReference = (ctx: Pick<Context, "extensionId" | "projectId">, id: string) => ({
  type: "ticket",
  id,
  extensionId: ctx.extensionId,
  projectId: ctx.projectId,
});
export const isPullRequest = (ref: ResourceRef) => ref.extensionId === "pstdio.github" && ref.type === "pull-request";

export const legacyPullRequestOrder = (ref: ResourceRef) =>
  `${ref.metadata?.plannerLinkedAt ?? ""}:${ref.metadata?.plannerLinkId ?? ""}`;

// Save each relationship before removing its legacy representation. A disabled provider leaves the old URLs intact.
export const migratePullRequestLinks = async (ctx: Context, ticket: Ticket) => {
  const stored = await ticketRecords(ctx.storage).get(ticket.id);
  for (const link of stored?.reviewLinks ?? []) {
    if (link.provider !== "github" || link.kind !== "pull_request") continue;
    try {
      const outcome = await ctx.commands.execute(importPr, { params: { url: link.url } });
      if (!outcome.ok) continue;
      const source = ticketReference(ctx, ticket.id);
      let cursor: string | undefined;
      let existing: ResourceAnchor | undefined;
      do {
        const page = await ctx.resources.queryAnchors({ resource: source, limit: 100, cursor });
        existing = page.items
          .map(({ target }) => target)
          .find((target) => isPullRequest(target) && target.id === outcome.value.id);
        cursor = page.nextCursor ?? undefined;
      } while (!existing && cursor);
      const order = `${link.createdAt}:${link.id}`;
      // Existing canonical choices win over arriving legacy data. Only migrate new links or refresh their own provenance.
      if (!existing || (existing.metadata?.plannerLinkedAt && legacyPullRequestOrder(existing) < order)) {
        const reference = existing ?? { ...outcome.value, role: "result" as const };
        await ctx.resources.addAnchors(source, [
          {
            ...reference,
            metadata: {
              ...reference.metadata,
              plannerLinkedAt: link.createdAt,
              plannerLinkId: link.id,
              reviewTitle: link.title,
            },
          },
        ]);
      }
      await changeTicketRecord(ctx.storage, ticket.id, (current) => ({
        ...current,
        reviewLinks: current.reviewLinks?.filter((saved) => saved.id !== link.id),
      }));
    } catch {
      /* Keep the legacy URL available until the provider and relationship service recover. */
    }
  }
};

export const pullRequestRelationships = async (
  ctx: Pick<Context, "resources" | "projectId" | "extensionId">,
  ticket: Ticket,
) => {
  const results: ResourceRef[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.resources.queryAnchors({
      resource: ticketReference(ctx, ticket.id),
      role: "result",
      direction: "outgoing",
      cursor,
      limit: 100,
    });
    results.push(...page.items.map(({ target }) => target).filter(isPullRequest));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return results;
};

export type GithubReads = Map<string, Promise<PullRequestRead>>;
export const readGithubResources = async (
  ctx: Pick<ExtensionContextBase, "commands">,
  ids: string[],
  reads: GithubReads = new Map(),
) => {
  const unique = [...new Set(ids)];
  const missing = unique.filter((id) => !reads.has(id));
  for (let offset = 0; offset < missing.length; offset += 100) {
    const batch = missing.slice(offset, offset + 100);
    const lookup = (async () => {
      try {
        const result = await ctx.commands.execute(readPrs, { params: { ids: batch } });
        if (result.ok) return result.value;
      } catch {
        /* Unavailable evidence cannot prove delivery. */
      }
      return [] as PullRequestRead[];
    })();
    for (const id of batch)
      reads.set(
        id,
        lookup.then(
          (values) =>
            values.find((value) => value.id === id) ?? { id, error: "GitHub pull request evidence is unavailable." },
        ),
      );
  }
  return Promise.all(unique.map((id) => reads.get(id)!));
};

export const linkedPullRequests = async (ctx: Context, ticket: Ticket) => {
  await migratePullRequestLinks(ctx, ticket);
  const stored = await ticketRecords(ctx.storage).get(ticket.id);
  if (stored?.reviewLinks?.some((link) => link.provider === "github" && link.kind === "pull_request")) return null;
  return pullRequestRelationships(ctx, ticket);
};
