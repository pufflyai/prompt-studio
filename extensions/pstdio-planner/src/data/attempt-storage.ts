import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type {
  AttemptLaunchClaim,
  AttemptRecord,
  AttemptTimelineEvent,
  HumanRequestRecord,
  ReviewComment,
  ReviewLaunchClaim,
  ReviewThread,
  TicketAttemptSelection,
} from "./attempt-types";

export const ATTEMPTS_COLLECTION = "planner-attempts";
export const ATTEMPT_EVENTS_COLLECTION = "planner-attempt-events";
export const REVIEW_THREADS_COLLECTION = "planner-review-threads";
export const REVIEW_COMMENTS_COLLECTION = "planner-review-comments";
export const ATTEMPT_SELECTIONS_COLLECTION = "planner-attempt-selections";
export const HUMAN_REQUESTS_COLLECTION = "planner-human-requests";
export const LAUNCH_CLAIMS_COLLECTION = "planner-attempt-launch-claims";
export const REVIEW_LAUNCH_CLAIMS_COLLECTION = "planner-review-launch-claims";

export const attemptsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<AttemptRecord>(ATTEMPTS_COLLECTION);

export const attemptEventsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<AttemptTimelineEvent>(ATTEMPT_EVENTS_COLLECTION);

export const reviewThreadsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<ReviewThread>(REVIEW_THREADS_COLLECTION);

export const reviewCommentsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<ReviewComment>(REVIEW_COMMENTS_COLLECTION);

export const attemptSelectionsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<TicketAttemptSelection>(ATTEMPT_SELECTIONS_COLLECTION);

export const humanRequestsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<HumanRequestRecord>(HUMAN_REQUESTS_COLLECTION);

export const launchClaimsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<AttemptLaunchClaim>(LAUNCH_CLAIMS_COLLECTION);

export const reviewLaunchClaimsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<ReviewLaunchClaim>(REVIEW_LAUNCH_CLAIMS_COLLECTION);

const isString = (value: unknown): value is string => typeof value === "string";
const isNullableString = (value: unknown) => value === null || isString(value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const attemptStates = new Set([
  "implementing",
  "review_ready",
  "reviewing",
  "approved",
  "changes_requested",
  "blocked",
  "abandoned",
]);
const reviewStates = new Set(["started", "submitted", "disconnected", "failed", "dismissed"]);
const reviewVerdicts = new Set(["passed", "changes_requested"]);

const isActor = (value: unknown) =>
  isRecord(value) &&
  (value.type === "human" || value.type === "agent" || value.type === "automation") &&
  isString(value.id) &&
  isString(value.displayName);

const isReview = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isNullableString(value.sessionId) &&
  isNullableString(value.reportId) &&
  isString(value.reviewedHeadSha) &&
  isActor(value.reviewer) &&
  reviewStates.has(String(value.state)) &&
  (value.verdict === null || reviewVerdicts.has(String(value.verdict))) &&
  isString(value.startedAt) &&
  isNullableString(value.completedAt) &&
  isNullableString(value.supersedesReviewId);

const isRevision = (value: unknown) =>
  isRecord(value) &&
  Number.isInteger(value.revision) &&
  Number(value.revision) > 0 &&
  isString(value.baseSha) &&
  isString(value.headSha) &&
  isString(value.changeRequestReportId) &&
  isString(value.submittedAt) &&
  isActor(value.submittedBy) &&
  Array.isArray(value.reviews) &&
  value.reviews.every(isReview);

const isBlocker = (value: unknown) =>
  value === null ||
  (isRecord(value) &&
    (value.phase === "implementation" || value.phase === "review" || value.phase === "workspace_setup") &&
    isString(value.reason) &&
    isNullableString(value.sessionId) &&
    Number.isInteger(value.retryCount) &&
    isNullableString(value.lastActivityAt) &&
    isString(value.createdAt));

export const isAttemptRecord = (value: unknown): value is AttemptRecord => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AttemptRecord>;
  return (
    record.schemaVersion === 1 &&
    isString(record.workspaceId) &&
    isString(record.workspaceShorthand) &&
    isString(record.ticketId) &&
    isString(record.ticketShorthand) &&
    isString(record.implementationSessionId) &&
    attemptStates.has(String(record.state)) &&
    Array.isArray(record.revisions) &&
    record.revisions.every(isRevision) &&
    isRecord(record.base) &&
    isNullableString(record.base.workspaceId) &&
    isString(record.base.headSha) &&
    Number.isInteger(record.implementationDisconnectRetries) &&
    Number.isInteger(record.reviewDisconnectRetries) &&
    isBlocker(record.blocker) &&
    isString(record.createdAt) &&
    isString(record.updatedAt)
  );
};

export const readAttempt = async (storage: ExtensionStorageApi, workspaceId: string) => {
  const value = await attemptsCollection(storage).get(workspaceId);
  if (value === undefined) return null;
  if (!isAttemptRecord(value)) throw new Error(`Invalid Planner attempt record for workspace "${workspaceId}"`);
  return value;
};

export const listAttempts = async (storage: ExtensionStorageApi) => {
  const values = await attemptsCollection(storage).list();
  for (const value of values) {
    if (!isAttemptRecord(value)) throw new Error("Invalid Planner attempt record");
  }
  return values;
};

export const putAttempt = async (storage: ExtensionStorageApi, attempt: AttemptRecord) => {
  if (!isAttemptRecord(attempt)) throw new Error("Invalid Planner attempt record");
  await attemptsCollection(storage).put(attempt.workspaceId, attempt);
  return attempt;
};

export const appendAttemptEvent = async (
  storage: ExtensionStorageApi,
  event: Omit<AttemptTimelineEvent, "id" | "createdAt"> & { id?: string; createdAt?: string },
) => {
  const stored: AttemptTimelineEvent = {
    ...event,
    id: event.id ?? crypto.randomUUID(),
    createdAt: event.createdAt ?? new Date().toISOString(),
  };
  await attemptEventsCollection(storage).put(stored.id, stored);
  return stored;
};
