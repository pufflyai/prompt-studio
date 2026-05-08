import type { EventStore, SessionMessage } from "../../types";
import { normalizeErrorPart } from "../normalized-error";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { isTransportTimeout } from "./opencode-service";
import { isTurnCompleted, isTurnInFlight, isTurnStale, resolveInFlightTurnProgressAt } from "./opencode-turn-state";
import type { OpencodeSessionMessage } from "./opencode-types";

export interface PostState {
  settled: boolean;
  timedOut: boolean;
  failed: boolean;
  failureMessage: string;
}

export interface PollSnapshot {
  snapshotChanged: boolean;
  lastObserved: OpencodeSessionMessage[];
  lastSnapshot: string;
  latestMessages: SessionMessage[];
}

export type SessionMessagesLoader = (sessionId: string, cwd?: string) => Promise<OpencodeSessionMessage[]>;

const OPENCODE_POLL_INTERVAL_MS = 1_000;
export const OPENCODE_STALE_TURN_TIMEOUT_MS = 30 * 60 * 1_000;

export const hasErrorParts = (messages: SessionMessage[]) =>
  messages.some((m) => m.parts.some((p) => p.type === "error"));

export const waitForNextPoll = (abortSignal?: AbortSignal, intervalMs = OPENCODE_POLL_INTERVAL_MS) =>
  new Promise<void>((resolve) => {
    if (abortSignal?.aborted) {
      resolve();
      return;
    }

    const finish = () => {
      clearTimeout(timeout);
      abortSignal?.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, intervalMs);
    abortSignal?.addEventListener("abort", finish, { once: true });
  });

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "OpenCode session failed.";
};

export const trackPostState = (messageComplete: Promise<void>): PostState => {
  const state: PostState = { settled: false, timedOut: false, failed: false, failureMessage: "" };
  messageComplete
    .then(() => {
      state.settled = true;
    })
    .catch((error: unknown) => {
      state.settled = true;
      if (isTransportTimeout(error)) {
        state.timedOut = true;
      } else {
        state.failed = true;
        state.failureMessage = toErrorMessage(error);
      }
    });
  return state;
};

export const disconnectStaleTurn = (eventStore: EventStore) => {
  eventStore.push({ op: "replace", path: "/status", value: "disconnected" });
  return { code: null as number | null, signal: "TIMEOUT" as string | null };
};

export const cancelTurn = (eventStore: EventStore) => {
  eventStore.push({ op: "replace", path: "/status", value: "cancelled" });
  return { code: null as number | null, signal: "SIGTERM" as string | null };
};

const shouldStopPolling = (input: {
  turnVisible: boolean;
  inFlight: boolean;
  turnCompleted: boolean;
  postState: PostState;
}) => {
  const { turnVisible, inFlight, turnCompleted, postState } = input;
  // The assistant finished its turn (completed timestamp or question asked).
  if (turnVisible && turnCompleted) return true;
  if (postState.failed && !turnVisible) return true;
  // POST succeeded with no visible effect and nothing in flight.
  return postState.settled && !postState.timedOut && !postState.failed && !inFlight && !turnVisible;
};

export const appendFailureMessage = (input: {
  sessionId: string;
  latestMessages: SessionMessage[];
  eventStore: EventStore;
  failureMessage: string;
}) => {
  const { sessionId, latestMessages, eventStore, failureMessage } = input;
  const failurePart = normalizeErrorPart({ message: failureMessage });
  const normalizedFailureMessage: SessionMessage = {
    id: `opencode-error-${sessionId}-${latestMessages.length}`,
    role: "system",
    parts: [failurePart],
    index: latestMessages.length,
  };

  const nextMessages = [...latestMessages, normalizedFailureMessage];
  eventStore.push({ op: "replace", path: "/messages", value: nextMessages });
  eventStore.push({ op: "replace", path: "/status", value: "failed" });
  return { code: 1 as number | null, signal: null as string | null };
};

export const readSessionSnapshot = async (input: {
  loadMessages: SessionMessagesLoader;
  sessionId: string;
  cwd: string | undefined;
  eventStore: EventStore;
  lastObserved: OpencodeSessionMessage[];
  lastSnapshot: string;
  latestMessages: SessionMessage[];
}) => {
  const { loadMessages, sessionId, cwd, eventStore } = input;

  try {
    const raw = await loadMessages(sessionId, cwd);
    const normalized = raw.map(normalizeOpencodeMessage);
    const snapshot = JSON.stringify(normalized);

    if (snapshot === input.lastSnapshot) {
      return {
        snapshotChanged: false,
        lastObserved: raw,
        lastSnapshot: input.lastSnapshot,
        latestMessages: input.latestMessages,
      } satisfies PollSnapshot;
    }

    eventStore.push({ op: "replace", path: "/messages", value: normalized });
    return {
      snapshotChanged: true,
      lastObserved: raw,
      lastSnapshot: snapshot,
      latestMessages: normalized,
    } satisfies PollSnapshot;
  } catch {
    return {
      snapshotChanged: false,
      lastObserved: input.lastObserved,
      lastSnapshot: input.lastSnapshot,
      latestMessages: input.latestMessages,
    } satisfies PollSnapshot;
  }
};

export const pollOpencodeMessages = async (input: {
  loadMessages: SessionMessagesLoader;
  sessionId: string;
  cwd: string | undefined;
  eventStore: EventStore;
  baselineCount: number;
  messageComplete: Promise<void>;
  abortSignal?: AbortSignal;
  pollIntervalMs?: number;
}) => {
  const { loadMessages, sessionId, cwd, eventStore, baselineCount, messageComplete, abortSignal, pollIntervalMs } =
    input;
  let lastSnapshot = "";
  let latestMessages: SessionMessage[] = [];
  let lastObserved: OpencodeSessionMessage[] = [];
  let lastInFlightProgressAt: number | null = null;
  const postState = trackPostState(messageComplete);

  while (true) {
    if (abortSignal?.aborted) {
      return cancelTurn(eventStore);
    }

    const snapshot = await readSessionSnapshot({
      loadMessages,
      sessionId,
      cwd,
      eventStore,
      lastObserved,
      lastSnapshot,
      latestMessages,
    });
    lastObserved = snapshot.lastObserved;
    lastSnapshot = snapshot.lastSnapshot;
    latestMessages = snapshot.latestMessages;

    if (abortSignal?.aborted) {
      return cancelTurn(eventStore);
    }

    const now = Date.now();
    const inFlight = isTurnInFlight(lastObserved);
    const turnCompleted = isTurnCompleted(lastObserved);
    const turnVisible = lastObserved.length > baselineCount;
    lastInFlightProgressAt = resolveInFlightTurnProgressAt({
      rawMessages: lastObserved,
      lastProgressAt: lastInFlightProgressAt,
      snapshotChanged: snapshot.snapshotChanged,
      now,
    });

    if (turnVisible && inFlight && isTurnStale(lastInFlightProgressAt, now, OPENCODE_STALE_TURN_TIMEOUT_MS)) {
      return disconnectStaleTurn(eventStore);
    }

    if (shouldStopPolling({ turnVisible, inFlight, turnCompleted, postState })) {
      break;
    }

    await waitForNextPoll(abortSignal, pollIntervalMs);
  }

  if (postState.failed) {
    return appendFailureMessage({
      sessionId,
      latestMessages,
      eventStore,
      failureMessage: postState.failureMessage,
    });
  }

  if (hasErrorParts(latestMessages.slice(baselineCount))) {
    eventStore.push({ op: "replace", path: "/status", value: "failed" });
    return { code: 1 as number | null, signal: null as string | null };
  }

  eventStore.push({ op: "replace", path: "/status", value: "completed" });
  return { code: 0 as number | null, signal: null as string | null };
};

export const pollOpencodeUntilIdle = async (input: {
  loadMessages: SessionMessagesLoader;
  sessionId: string;
  cwd: string | undefined;
  eventStore: EventStore;
  abortSignal?: AbortSignal;
  pollIntervalMs?: number;
}) => {
  const { loadMessages, sessionId, cwd, eventStore, abortSignal, pollIntervalMs } = input;
  let lastSnapshot = "";
  let latestMessages: SessionMessage[] = [];
  let lastObserved: OpencodeSessionMessage[] = [];
  let lastInFlightProgressAt: number | null = null;

  while (true) {
    if (abortSignal?.aborted) {
      return cancelTurn(eventStore);
    }

    const snapshot = await readSessionSnapshot({
      loadMessages,
      sessionId,
      cwd,
      eventStore,
      lastObserved,
      lastSnapshot,
      latestMessages,
    });
    lastObserved = snapshot.lastObserved;
    lastSnapshot = snapshot.lastSnapshot;
    latestMessages = snapshot.latestMessages;

    if (abortSignal?.aborted) {
      return cancelTurn(eventStore);
    }

    const now = Date.now();
    lastInFlightProgressAt = resolveInFlightTurnProgressAt({
      rawMessages: lastObserved,
      lastProgressAt: lastInFlightProgressAt,
      snapshotChanged: snapshot.snapshotChanged,
      now,
    });

    if (isTurnStale(lastInFlightProgressAt, now, OPENCODE_STALE_TURN_TIMEOUT_MS)) {
      return disconnectStaleTurn(eventStore);
    }

    if (!isTurnInFlight(lastObserved)) {
      break;
    }

    await waitForNextPoll(abortSignal, pollIntervalMs);
  }

  const trailing = latestMessages.at(-1);
  if (trailing && hasErrorParts([trailing])) {
    eventStore.push({ op: "replace", path: "/status", value: "failed" });
    return { code: 1 as number | null, signal: null as string | null };
  }

  eventStore.push({ op: "replace", path: "/status", value: "completed" });
  return { code: 0 as number | null, signal: null as string | null };
};
