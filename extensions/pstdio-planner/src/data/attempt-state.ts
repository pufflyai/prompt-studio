import type { ActorRef, AttemptRevision, AttemptTimelineEvent } from "./attempt-types";

type RevisionInput = {
  baseSha: string;
  headSha: string;
  changeRequestReportId: string;
  submittedAt: string;
  submittedBy: ActorRef;
};

export const deriveRevisionVerdict = (revision: AttemptRevision) => {
  const active = revision.reviews.filter((review) => review.state === "submitted");
  if (active.some((review) => review.verdict === "changes_requested")) return "changes_requested" as const;
  if (active.some((review) => review.verdict === "passed")) return "passed" as const;
  return null;
};

export const appendRevision = (revisions: AttemptRevision[], input: RevisionInput) => {
  const previous = revisions.at(-1);
  if (previous?.headSha === input.headSha) {
    if (previous.changeRequestReportId === input.changeRequestReportId) return revisions;
    throw new Error("A new revision requires a different HEAD");
  }

  return [
    ...revisions,
    {
      revision: (previous?.revision ?? 0) + 1,
      ...input,
      reviews: [],
    },
  ];
};

const eventKey = (event: Pick<AttemptTimelineEvent, "createdAt" | "id">) => `${event.createdAt}|${event.id}`;

export const paginateAttemptEvents = <TEvent extends Pick<AttemptTimelineEvent, "createdAt" | "id">>(
  events: TEvent[],
  cursor: string | undefined,
  limit: number,
) => {
  const ordered = [...events].sort((left, right) => eventKey(left).localeCompare(eventKey(right)));
  const start = cursor ? ordered.findIndex((event) => eventKey(event) > cursor) : 0;
  const safeStart = start < 0 ? ordered.length : start;
  const items = ordered.slice(safeStart, safeStart + limit);
  const hasMore = safeStart + items.length < ordered.length;
  return { items, nextCursor: hasMore && items.length > 0 ? eventKey(items.at(-1)!) : null };
};
