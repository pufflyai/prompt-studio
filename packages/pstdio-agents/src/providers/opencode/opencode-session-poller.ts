import type { EventStore, SessionMessage } from "../../types";
import { normalizeErrorPart } from "../normalized-error";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { isTransportTimeout } from "./opencode-service";
import { isTurnInFlight, isTurnStale, resolveInFlightTurnProgressAt } from "./opencode-turn-state";
import type { OpencodeSessionMessage } from "./opencode-types";

interface PostState {
  settled: boolean;
  timedOut: boolean;
  failed: boolean;
  failureMessage: string;
}

interface PollSnapshot {
  snapshotChanged: boolean;
  lastObserved: OpencodeSessionMessage[];
  lastSnapshot: string;
  latestMessages: SessionMessage[];
}

type SessionMessagesLoader = (sessionId: string, cwd?: string) => Promise<OpencodeSessionMessage[]>;

const OPENCODE_POLL_INTERVAL_MS = 1_000;
const OPENCODE_STALE_TURN_TIMEOUT_MS = 30 * 60 * 1_000;

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "OpenCode session failed.";
};

const trackPostState = (messageComplete: Promise<void>): PostState => {
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

const disconnectStaleTurn = (eventStore: EventStore) => {
  eventStore.push({ op: "replace", path: "/status", value: "disconnected" });
  return { code: null as number | null, signal: "TIMEOUT" as string | null };
};

const shouldStopPolling = (input: { turnVisible: boolean; inFlight: boolean; postState: PostState }) => {
  const { turnVisible, inFlight, postState } = input;
  if (turnVisible && !inFlight) return true;
  if (postState.failed && !turnVisible) return true;
  return postState.settled && !postState.timedOut && !postState.failed && !inFlight && !turnVisible;
};

const appendFailureMessage = (input: {
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

const readSessionSnapshot = async (input: {
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
}) => {
  const { loadMessages, sessionId, cwd, eventStore, baselineCount, messageComplete } = input;
  let lastSnapshot = "";
  let latestMessages: SessionMessage[] = [];
  let lastObserved: OpencodeSessionMessage[] = [];
  let lastInFlightProgressAt: number | null = null;
  const postState = trackPostState(messageComplete);

  while (true) {
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

    const now = Date.now();
    const inFlight = isTurnInFlight(lastObserved);
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

    if (shouldStopPolling({ turnVisible, inFlight, postState })) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, OPENCODE_POLL_INTERVAL_MS));
  }

  if (postState.failed) {
    return appendFailureMessage({
      sessionId,
      latestMessages,
      eventStore,
      failureMessage: postState.failureMessage,
    });
  }

  eventStore.push({ op: "replace", path: "/status", value: "completed" });
  return { code: 0 as number | null, signal: null as string | null };
};

export const pollOpencodeUntilIdle = async (input: {
  loadMessages: SessionMessagesLoader;
  sessionId: string;
  cwd: string | undefined;
  eventStore: EventStore;
}) => {
  const { loadMessages, sessionId, cwd, eventStore } = input;
  let lastSnapshot = "";
  let latestMessages: SessionMessage[] = [];
  let lastObserved: OpencodeSessionMessage[] = [];
  let lastInFlightProgressAt: number | null = null;

  while (true) {
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

    await new Promise((resolve) => setTimeout(resolve, OPENCODE_POLL_INTERVAL_MS));
  }

  eventStore.push({ op: "replace", path: "/status", value: "completed" });
  return { code: 0 as number | null, signal: null as string | null };
};
