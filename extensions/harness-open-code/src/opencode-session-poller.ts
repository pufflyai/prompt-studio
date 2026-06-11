import type { HarnessEventSink, HarnessExit, SessionMessage } from "@pstdio/sdk/extensions";
import { normalizeErrorPart } from "./normalized-error";
import { isTransportTimeout } from "./opencode-http";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
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

export const disconnectStaleTurn = (events: HarnessEventSink): HarnessExit => {
  events.push({ op: "replace", path: "/status", value: "disconnected" });
  return { status: "disconnected" };
};

export const cancelTurn = (events: HarnessEventSink): HarnessExit => {
  events.push({ op: "replace", path: "/status", value: "cancelled" });
  return { status: "cancelled" };
};

export const failTurn = (events: HarnessEventSink): HarnessExit => {
  events.push({ op: "replace", path: "/status", value: "failed" });
  return { status: "failed" };
};

export const completeTurn = (events: HarnessEventSink): HarnessExit => {
  events.push({ op: "replace", path: "/status", value: "completed" });
  return { status: "completed" };
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
  events: HarnessEventSink;
  failureMessage: string;
}): HarnessExit => {
  const { sessionId, latestMessages, events, failureMessage } = input;
  const failurePart = normalizeErrorPart({ message: failureMessage });
  const normalizedFailureMessage: SessionMessage = {
    id: `opencode-error-${sessionId}-${latestMessages.length}`,
    role: "system",
    parts: [failurePart],
    index: latestMessages.length,
  };

  const nextMessages = [...latestMessages, normalizedFailureMessage];
  events.push({ op: "replace", path: "/messages", value: nextMessages });
  return failTurn(events);
};

export const readSessionSnapshot = async (input: {
  loadMessages: SessionMessagesLoader;
  sessionId: string;
  cwd: string | undefined;
  events: HarnessEventSink;
  lastObserved: OpencodeSessionMessage[];
  lastSnapshot: string;
  latestMessages: SessionMessage[];
}) => {
  const { loadMessages, sessionId, cwd, events } = input;

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

    events.push({ op: "replace", path: "/messages", value: normalized });
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
  events: HarnessEventSink;
  baselineCount: number;
  messageComplete: Promise<void>;
  abortSignal?: AbortSignal;
  pollIntervalMs?: number;
}) => {
  const { loadMessages, sessionId, cwd, events, baselineCount, messageComplete, abortSignal, pollIntervalMs } = input;
  let lastSnapshot = "";
  let latestMessages: SessionMessage[] = [];
  let lastObserved: OpencodeSessionMessage[] = [];
  let lastInFlightProgressAt: number | null = null;
  const postState = trackPostState(messageComplete);

  while (true) {
    if (abortSignal?.aborted) {
      return cancelTurn(events);
    }

    const snapshot = await readSessionSnapshot({
      loadMessages,
      sessionId,
      cwd,
      events,
      lastObserved,
      lastSnapshot,
      latestMessages,
    });
    lastObserved = snapshot.lastObserved;
    lastSnapshot = snapshot.lastSnapshot;
    latestMessages = snapshot.latestMessages;

    if (abortSignal?.aborted) {
      return cancelTurn(events);
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
      return disconnectStaleTurn(events);
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
      events,
      failureMessage: postState.failureMessage,
    });
  }

  if (hasErrorParts(latestMessages.slice(baselineCount))) {
    return failTurn(events);
  }

  return completeTurn(events);
};

export const pollOpencodeUntilIdle = async (input: {
  loadMessages: SessionMessagesLoader;
  sessionId: string;
  cwd: string | undefined;
  events: HarnessEventSink;
  abortSignal?: AbortSignal;
  pollIntervalMs?: number;
}) => {
  const { loadMessages, sessionId, cwd, events, abortSignal, pollIntervalMs } = input;
  let lastSnapshot = "";
  let latestMessages: SessionMessage[] = [];
  let lastObserved: OpencodeSessionMessage[] = [];
  let lastInFlightProgressAt: number | null = null;

  while (true) {
    if (abortSignal?.aborted) {
      return cancelTurn(events);
    }

    const snapshot = await readSessionSnapshot({
      loadMessages,
      sessionId,
      cwd,
      events,
      lastObserved,
      lastSnapshot,
      latestMessages,
    });
    lastObserved = snapshot.lastObserved;
    lastSnapshot = snapshot.lastSnapshot;
    latestMessages = snapshot.latestMessages;

    if (abortSignal?.aborted) {
      return cancelTurn(events);
    }

    const now = Date.now();
    lastInFlightProgressAt = resolveInFlightTurnProgressAt({
      rawMessages: lastObserved,
      lastProgressAt: lastInFlightProgressAt,
      snapshotChanged: snapshot.snapshotChanged,
      now,
    });

    if (isTurnStale(lastInFlightProgressAt, now, OPENCODE_STALE_TURN_TIMEOUT_MS)) {
      return disconnectStaleTurn(events);
    }

    if (!isTurnInFlight(lastObserved)) {
      break;
    }

    await waitForNextPoll(abortSignal, pollIntervalMs);
  }

  const trailing = latestMessages.at(-1);
  if (trailing && hasErrorParts([trailing])) {
    return failTurn(events);
  }

  return completeTurn(events);
};
