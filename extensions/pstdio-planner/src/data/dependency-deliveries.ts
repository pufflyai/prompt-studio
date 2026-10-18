import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { readGithubMerge } from "./github-merges";
import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { StoredTicket } from "./types";

export interface DependencyDelivery {
  headSha: string | null;
  mergeSha: string | null;
}

export type DependencyDeliveryReads = Map<string, Promise<DependencyDelivery | null>>;

export async function readDependencyDeliveries(
  ctx: Pick<ExtensionContextBase, "process" | "logger">,
  target: StoredTicket,
  tickets: StoredTicket[],
  doneStatusIds: Set<string>,
  cwd: string,
  reads: DependencyDeliveryReads = new Map(),
) {
  const byRef = new Map(
    tickets.flatMap((ticket) => [
      [ticket.id, ticket],
      [ticket.shorthand, ticket],
    ]),
  );
  const seen = new Set([target.id]);
  const pending = [target];
  const checks: Array<{ ticketId: string; url: string }> = [];
  for (const ticket of pending) {
    for (const ref of normalizeTicketDependencies(ticket.dependsOn)) {
      const dependency = byRef.get(ref);
      if (!dependency || seen.has(dependency.id)) continue;
      seen.add(dependency.id);
      pending.push(dependency);
      if (!doneStatusIds.has(dependency.statusId ?? "")) continue;
      // A replacement PR supersedes an older stack-promotion PR, even while it is still open.
      const [latest] = (dependency.reviewLinks ?? [])
        .filter((link) => link.provider === "github" && link.kind === "pull_request")
        .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
      if (latest) checks.push({ ticketId: dependency.id, url: latest.url });
    }
  }
  const deliveries = new Map<string, DependencyDelivery>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, checks.length) }, async () => {
      while (next < checks.length) {
        const check = checks[next++]!;
        let read = reads.get(check.url);
        if (!read) {
          read = readGithubMerge<DependencyDelivery>(
            ctx,
            ["gh", "pr", "view", check.url, "--json", "state,headRefOid,mergeCommit"],
            cwd,
            (output) => {
              const value = JSON.parse(output);
              return {
                headSha: typeof value.headRefOid === "string" ? value.headRefOid : null,
                mergeSha:
                  value.state === "MERGED" && typeof value.mergeCommit?.oid === "string" ? value.mergeCommit.oid : null,
              };
            },
          );
          reads.set(check.url, read);
        }
        const delivery = await read;
        // An unavailable PR cannot provide delivery evidence; never fall back to an older PR.
        deliveries.set(check.ticketId, delivery ?? { headSha: null, mergeSha: null });
      }
    }),
  );
  return deliveries;
}
