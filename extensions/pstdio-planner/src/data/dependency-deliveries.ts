import type { ExtensionContextBase, ResourceRef } from "@pstdio/sdk/extensions";
import { readRetiredWorkspaceIds } from "./attempt-retirement";
import { attemptSelectionsCollection, listAttempts } from "./attempt-storage";
import type { AttemptRecord, TicketAttemptSelection } from "./attempt-types";
import { linkedPullRequests, readGithubResources } from "./pull-request-resources";
import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { Ticket } from "./types";

export interface DependencyDelivery {
  headSha: string | null;
  mergeSha: string | null;
}
export type DependencyDeliveryReads = Map<string, Promise<(DependencyDelivery & { target: string }) | null>>;

type Context = Pick<ExtensionContextBase, "commands" | "extensionId" | "projectId" | "resources" | "storage">;
const unavailable = () => ({ headSha: null, mergeSha: null });
const readDelivery = async (
  ctx: Context,
  dependency: Ticket,
  links: ResourceRef[],
  history: { attempts: AttemptRecord[]; selections: TicketAttemptSelection[]; retired: Set<string> },
  reads: DependencyDeliveryReads,
) => {
  const { attempts, selections, retired } = history;
  const unsequenced = links.filter((link) => !link.metadata?.plannerLinkedAt);
  // Legacy links retain their original order. Generic results have no chronology: the submitted revision decides.
  const candidates = unsequenced.length
    ? unsequenced
    : links
        .toSorted(
          (left, right) =>
            String(right.metadata?.plannerLinkedAt).localeCompare(String(left.metadata?.plannerLinkedAt)) ||
            right.id.localeCompare(left.id),
        )
        .slice(0, 1);
  const selected = selections.find((selection) => selection.ticketId === dependency.id);
  const heads = new Set(
    attempts
      .filter(
        (attempt) =>
          attempt.ticketId === dependency.id &&
          !retired.has(attempt.workspaceId) &&
          (!selected || attempt.workspaceId === selected.workspaceId),
      )
      .flatMap((attempt) => attempt.revisions.at(-1)?.headSha ?? []),
  );
  const expected = heads.size === 1 ? [...heads][0] : undefined;
  const values = await Promise.all(
    candidates.map((link) => {
      let read = reads.get(link.id);
      if (!read) {
        read = readGithubResources(ctx, [link.id]).then(([value]) =>
          value && !("error" in value)
            ? {
                target: `${value.id.slice(0, value.id.lastIndexOf("/pull/"))}:${value.baseRefName}`,
                headSha: value.headRefOid,
                mergeSha: value.state === "MERGED" ? (value.mergeCommit?.oid ?? null) : null,
              }
            : null,
        );
        reads.set(link.id, read);
      }
      return read;
    }),
  );
  const unknown = values.some((value) => !value);
  const matching = expected ? values.filter((value) => value?.headSha === expected) : values;
  const first = matching[0];
  if (unknown || !first || (unsequenced.length > 1 && !expected) || heads.size > 1) {
    return unavailable();
  }
  const sameMerge = matching.every(
    (value) => value?.headSha === first.headSha && value?.mergeSha === first.mergeSha && value?.target === first.target,
  );
  return { headSha: first.headSha, mergeSha: sameMerge ? first.mergeSha : null };
};

export async function readDependencyDeliveries(
  ctx: Pick<ExtensionContextBase, "commands" | "extensionId" | "projectId" | "resources" | "storage">,
  target: Ticket,
  tickets: Ticket[],
  doneStatusIds: Set<string>,
  _cwd: string,
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
  const deliveries = new Map<string, DependencyDelivery>();
  const [attempts, selections, retired] = await Promise.all([
    listAttempts(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
    readRetiredWorkspaceIds(ctx.storage),
  ]);
  for (const ticket of pending) {
    for (const ref of normalizeTicketDependencies(ticket.dependsOn)) {
      const dependency = byRef.get(ref);
      if (!dependency || seen.has(dependency.id)) continue;
      seen.add(dependency.id);
      pending.push(dependency);
      if (!doneStatusIds.has(dependency.statusId ?? "")) continue;
      const links = await linkedPullRequests(ctx, dependency);
      if (!links) {
        deliveries.set(dependency.id, unavailable());
        continue;
      }
      if (!links.length) continue;
      deliveries.set(
        dependency.id,
        await readDelivery(ctx, dependency, links, { attempts, selections, retired }, reads),
      );
    }
  }
  return deliveries;
}
