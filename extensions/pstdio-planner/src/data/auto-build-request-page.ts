import type { ExtensionContextBase, StoragePredicate, StorageRecordQuery } from "@pstdio/sdk/extensions";
import { readAutoBuildOwnership } from "./auto-build-ownership";
import { linkedAutoBuildRequestPages } from "./auto-build-request-links";
import { pendingReviewRequest } from "./review-query-indexes";
import { readReviewRequest } from "./review-request-storage";
import type { ReviewRequestView } from "./review-request-types";
import { preparePlannerIndexes } from "./storage-indexes";

export interface PendingRequestScope {
  where: StoragePredicate;
  related?: StorageRecordQuery["related"];
}

export const readPendingAutoBuildRequests = async (
  ctx: Pick<ExtensionContextBase, "storage">,
  supervisorId?: string,
  scope?: PendingRequestScope,
  offset = 0,
) => {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Request offset must be a nonnegative integer");
  const ownership = supervisorId ? await readAutoBuildOwnership(ctx, supervisorId) : undefined;
  await preparePlannerIndexes(ctx.storage);
  type Candidate = { id: string; requestedAt: string };
  let candidates: Candidate[] = [];
  let total = 0;
  const keep = (page: { fields: Record<string, unknown> }[]) => {
    candidates.push(
      ...page.map(({ fields }) => ({ id: String(fields.id), requestedAt: String(fields.requestedAt ?? "") })),
    );
    candidates.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.id.localeCompare(b.id));
    candidates = candidates.slice(0, offset + 26);
  };
  const query = {
    index: "review-request-state",
    related: scope?.related,
    fields: ["id", "requestedAt"],
    orderBy: [
      { field: "requestedAt", direction: "asc" as const },
      { field: "id", direction: "asc" as const },
    ],
  };
  if (scope) {
    const where: StoragePredicate = { all: [scope.where, pendingReviewRequest] };
    const count = await ctx.storage.records.aggregate({ ...query, where });
    total = count.count;
    let cursor: string | undefined;
    let selected = 0;
    do {
      const page = await ctx.storage.records.query({
        ...query,
        where,
        limit: Math.min(100, offset + 26 - selected),
        cursor,
        revision: count.revision,
      });
      keep(page.records);
      selected += page.records.length;
      cursor = page.cursor ?? undefined;
    } while (cursor && selected < offset + 26);
  }
  if (ownership)
    for await (const links of linkedAutoBuildRequestPages(ctx.storage, ownership)) {
      const where: StoragePredicate = {
        all: [
          { field: "id", op: "in", value: links.map(({ id }) => id) },
          pendingReviewRequest,
          ...(scope ? [{ not: scope.where }] : []),
        ],
      };
      const page = await ctx.storage.records.query({ ...query, where, limit: 100 });
      total += page.records.length;
      keep(page.records);
    }
  const requests: ReviewRequestView[] = [],
    errors: string[] = [];
  for (const { id } of candidates.slice(offset, offset + 25)) {
    try {
      const request = await readReviewRequest(ctx.storage, id);
      if (request) requests.push(request);
    } catch (reason) {
      errors.push(`Request ${id}: ${String(reason)}`);
    }
  }
  return { requests, errors, total, offset, hasNext: offset + 25 < total };
};
