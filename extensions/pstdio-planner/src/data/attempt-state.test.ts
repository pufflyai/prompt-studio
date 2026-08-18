import { describe, expect, test } from "bun:test";
import { appendRevision, deriveRevisionVerdict, paginateAttemptEvents } from "./attempt-state";
import { isAttemptRecord } from "./attempt-storage";
import type { AttemptReview, AttemptRevision } from "./attempt-types";

const actor = { type: "agent" as const, id: "agent-1", displayName: "Agent" };

const review = (overrides: Partial<AttemptReview> & { id: string }): AttemptReview => ({
  sessionId: `session-${overrides.id}`,
  reportId: `report-${overrides.id}`,
  reviewedHeadSha: "head-1",
  reviewer: actor,
  state: "submitted",
  verdict: "passed",
  startedAt: "2026-08-18T10:00:00.000Z",
  completedAt: "2026-08-18T10:10:00.000Z",
  supersedesReviewId: null,
  ...overrides,
  id: overrides.id,
});

const revision = (reviews: AttemptReview[]): AttemptRevision => ({
  revision: 1,
  baseSha: "base-1",
  headSha: "head-1",
  changeRequestReportId: "report-change-1",
  submittedAt: "2026-08-18T09:00:00.000Z",
  submittedBy: actor,
  reviews,
});

describe("attempt revision state", () => {
  test("rejects malformed stored attempt states and revisions", () => {
    expect(isAttemptRecord({ schemaVersion: 1, state: "invented" })).toBe(false);
    expect(
      isAttemptRecord({
        schemaVersion: 1,
        workspaceId: "workspace-1",
        workspaceShorthand: "PS-1_A1",
        ticketId: "ticket-1",
        ticketShorthand: "PS-1",
        implementationSessionId: "session-1",
        state: "review_ready",
        base: { workspaceId: null, headSha: "base-sha" },
        revisions: [{ revision: 1 }],
        implementationDisconnectRetries: 0,
        reviewDisconnectRetries: 0,
        blocker: null,
        createdAt: "2026-08-18T09:00:00.000Z",
        updatedAt: "2026-08-18T09:00:00.000Z",
      }),
    ).toBe(false);
  });
  test("keeps review rounds ordered and gives active requested changes precedence", () => {
    const first = review({ id: "review-1" });
    const second = review({ id: "review-2", verdict: "changes_requested" });
    const current = revision([first, second]);

    expect(current.reviews.map((entry) => entry.id)).toEqual(["review-1", "review-2"]);
    expect(deriveRevisionVerdict(current)).toBe("changes_requested");
    expect(first.verdict).toBe("passed");
  });

  test("dismissal removes a review from aggregation without deleting it", () => {
    const requested = review({ id: "review-1", verdict: "changes_requested", state: "dismissed" });
    const passed = review({ id: "review-2" });
    const current = revision([requested, passed]);

    expect(deriveRevisionVerdict(current)).toBe("passed");
    expect(current.reviews).toHaveLength(2);
  });

  test("appends a new immutable revision and rejects a repeated head", () => {
    const first = revision([]);
    const next = appendRevision([first], {
      baseSha: "base-1",
      headSha: "head-2",
      changeRequestReportId: "report-change-2",
      submittedAt: "2026-08-18T11:00:00.000Z",
      submittedBy: actor,
    });

    expect(next.map((entry) => entry.revision)).toEqual([1, 2]);
    expect(first).toEqual(revision([]));
    expect(() =>
      appendRevision(next, {
        baseSha: "base-1",
        headSha: "head-2",
        changeRequestReportId: "report-change-3",
        submittedAt: "2026-08-18T12:00:00.000Z",
        submittedBy: actor,
      }),
    ).toThrow("A new revision requires a different HEAD");
  });

  test("pages timeline events in stable chronological order", () => {
    const events = [
      { id: "b", createdAt: "2026-08-18T10:00:00.000Z" },
      { id: "c", createdAt: "2026-08-18T11:00:00.000Z" },
      { id: "a", createdAt: "2026-08-18T10:00:00.000Z" },
    ];

    const first = paginateAttemptEvents(events, undefined, 2);
    const second = paginateAttemptEvents(events, first.nextCursor ?? undefined, 2);

    expect(first.items.map((event) => event.id)).toEqual(["a", "b"]);
    expect(second.items.map((event) => event.id)).toEqual(["c"]);
    expect(second.nextCursor).toBeNull();
  });
});
