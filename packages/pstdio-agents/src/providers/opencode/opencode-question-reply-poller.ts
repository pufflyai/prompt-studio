import type { EventStore, SessionMessage } from "../../types";
import {
  appendFailureMessage,
  cancelTurn,
  disconnectStaleTurn,
  hasErrorParts,
  OPENCODE_STALE_TURN_TIMEOUT_MS,
  type PollSnapshot,
  type PostState,
  readSessionSnapshot,
  type SessionMessagesLoader,
  trackPostState,
  waitForNextPoll,
} from "./opencode-session-poller";
import { isTurnInFlight, isTurnStale } from "./opencode-turn-state";
import type { OpencodeSessionMessage } from "./opencode-types";

type QuestionToolRef = { messageID?: string; callID?: string };
type QuestionResponse = { answers: string[][] };

const OPENCODE_QUESTION_REPLY_IDLE_GRACE_MS = 10_000;

interface QuestionReplyPollState {
  lastSnapshot: string;
  latestMessages: SessionMessage[];
  lastObserved: OpencodeSessionMessage[];
  lastProgressAt: number | null;
  terminalSnapshot: string | null;
  settledIdleSince: number | null;
}

interface QuestionReplyPollSignals {
  questionTerminal: boolean;
  inFlight: boolean;
  settledWithNoTurnInFlight: boolean;
}

const createQuestionReplyPollState = () => ({
  lastSnapshot: "",
  latestMessages: [],
  lastObserved: [],
  lastProgressAt: null,
  terminalSnapshot: null,
  settledIdleSince: null,
});

const getRawMessageParts = (message: OpencodeSessionMessage) => {
  if ("parts" in message && Array.isArray(message.parts)) return message.parts;
  if ("content" in message && Array.isArray(message.content)) return message.content;
  return [];
};

const getRawMessageId = (message: OpencodeSessionMessage) => {
  if ("info" in message) return message.info?.id;
  return undefined;
};

const isTerminalQuestionStatus = (status: string | undefined) =>
  status === "completed" || status === "error" || status === "failed" || status === "output-error";

const isFailedQuestionStatus = (status: string | undefined) =>
  status === "error" || status === "failed" || status === "output-error";

const getQuestionReplyState = (messages: OpencodeSessionMessage[], questionTool: QuestionToolRef | undefined) => {
  for (const message of messages) {
    const messageId = getRawMessageId(message);
    if (questionTool?.messageID && messageId !== questionTool.messageID) continue;

    for (const part of getRawMessageParts(message)) {
      if (part.type !== "tool") continue;
      if (part.tool?.toLowerCase() !== "question") continue;
      if (questionTool?.callID && part.callID !== questionTool.callID) continue;

      return { status: part.state?.status };
    }
  }

  return null;
};

const hasQuestionResponsePayload = (state: SessionMessage["parts"][number]) => {
  if (state.type !== "tool") return false;
  const output = state.state?.output;
  if (typeof output === "string" && output.trim().length > 0) return true;
  if (Array.isArray(output) && output.length > 0) return true;
  if (typeof output === "object" && output !== null && Object.keys(output).length > 0) return true;
  if (output !== undefined && output !== null && typeof output !== "string") return true;

  const metadata = state.state?.metadata;
  return typeof metadata === "object" && metadata !== null && "answers" in metadata;
};

const markQuestionToolAnswered = (input: {
  messages: SessionMessage[];
  questionTool: QuestionToolRef | undefined;
  questionResponse: QuestionResponse | undefined;
}) => {
  const { messages, questionTool, questionResponse } = input;
  if (!questionResponse) return messages;

  let changed = false;
  const nextMessages = messages.map((message) => {
    if (questionTool?.messageID && message.id !== questionTool.messageID) return message;

    const parts = message.parts.map((part) => {
      if (part.type !== "tool") return part;
      if (part.tool.toLowerCase() !== "question") return part;
      if (questionTool?.callID && part.callId !== questionTool.callID) return part;
      if (hasQuestionResponsePayload(part)) return part;

      changed = true;
      return {
        ...part,
        status: "completed" as const,
        state: {
          ...part.state,
          status: "completed",
          output: "User has answered your questions.",
          metadata: { answers: questionResponse.answers },
        },
      };
    });

    return parts === message.parts ? message : { ...message, parts };
  });

  return changed ? nextMessages : messages;
};

const applyQuestionReplySnapshot = (state: QuestionReplyPollState, snapshot: PollSnapshot) => {
  state.lastObserved = snapshot.lastObserved;
  state.lastSnapshot = snapshot.lastSnapshot;
  state.latestMessages = snapshot.latestMessages;
};

const trackQuestionReplyProgress = (state: QuestionReplyPollState, snapshotChanged: boolean, now: number) => {
  if (state.lastProgressAt === null || snapshotChanged) {
    state.lastProgressAt = now;
  }
};

const getQuestionReplyPollSignals = (input: {
  lastObserved: OpencodeSessionMessage[];
  questionTool: QuestionToolRef | undefined;
  postState: PostState;
}) => {
  const { lastObserved, questionTool, postState } = input;
  const replyState = getQuestionReplyState(lastObserved, questionTool);
  const inFlight = isTurnInFlight(lastObserved);

  return {
    questionTerminal: isTerminalQuestionStatus(replyState?.status),
    inFlight,
    settledWithNoTurnInFlight: postState.settled && !postState.timedOut && !postState.failed && !inFlight,
  } satisfies QuestionReplyPollSignals;
};

const isQuietAfterTerminalSnapshot = (
  state: QuestionReplyPollState,
  signals: QuestionReplyPollSignals,
  snapshotChanged: boolean,
) =>
  signals.questionTerminal &&
  !signals.inFlight &&
  state.terminalSnapshot !== null &&
  state.terminalSnapshot === state.lastSnapshot &&
  !snapshotChanged;

const isQuietAfterSettledIdleSnapshot = (input: {
  state: QuestionReplyPollState;
  signals: QuestionReplyPollSignals;
  snapshotChanged: boolean;
  now: number;
}) => {
  const { state, signals, snapshotChanged, now } = input;
  return (
    signals.settledWithNoTurnInFlight &&
    state.settledIdleSince !== null &&
    !snapshotChanged &&
    now - state.settledIdleSince >= OPENCODE_QUESTION_REPLY_IDLE_GRACE_MS
  );
};

const shouldStopQuestionReplyPolling = (input: {
  state: QuestionReplyPollState;
  signals: QuestionReplyPollSignals;
  snapshotChanged: boolean;
  now: number;
}) => {
  const { state, signals, snapshotChanged, now } = input;
  if (isQuietAfterTerminalSnapshot(state, signals, snapshotChanged)) return true;

  return isQuietAfterSettledIdleSnapshot({ state, signals, snapshotChanged, now });
};

const updateQuestionReplyIdleMarkers = (input: {
  state: QuestionReplyPollState;
  signals: QuestionReplyPollSignals;
  snapshotChanged: boolean;
  now: number;
}) => {
  const { state, signals, snapshotChanged, now } = input;
  state.terminalSnapshot = signals.questionTerminal && !signals.inFlight ? state.lastSnapshot : null;

  if (!signals.settledWithNoTurnInFlight) {
    state.settledIdleSince = null;
    return;
  }

  state.settledIdleSince = snapshotChanged || state.settledIdleSince === null ? now : state.settledIdleSince;
};

export const pollOpencodeQuestionReply = async (input: {
  loadMessages: SessionMessagesLoader;
  sessionId: string;
  cwd: string | undefined;
  eventStore: EventStore;
  questionTool?: QuestionToolRef;
  questionResponse?: QuestionResponse;
  messageComplete: Promise<void>;
  abortSignal?: AbortSignal;
}) => {
  const { loadMessages, sessionId, cwd, eventStore, questionTool, questionResponse, messageComplete, abortSignal } =
    input;
  const state: QuestionReplyPollState = createQuestionReplyPollState();
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
      lastObserved: state.lastObserved,
      lastSnapshot: state.lastSnapshot,
      latestMessages: state.latestMessages,
    });
    applyQuestionReplySnapshot(state, snapshot);

    if (abortSignal?.aborted) {
      return cancelTurn(eventStore);
    }

    const now = Date.now();
    trackQuestionReplyProgress(state, snapshot.snapshotChanged, now);

    const signals = getQuestionReplyPollSignals({ lastObserved: state.lastObserved, questionTool, postState });
    if (shouldStopQuestionReplyPolling({ state, signals, snapshotChanged: snapshot.snapshotChanged, now })) {
      break;
    }

    updateQuestionReplyIdleMarkers({ state, signals, snapshotChanged: snapshot.snapshotChanged, now });

    if (postState.failed) {
      return appendFailureMessage({
        sessionId,
        latestMessages: state.latestMessages,
        eventStore,
        failureMessage: postState.failureMessage,
      });
    }

    if (isTurnStale(state.lastProgressAt, now, OPENCODE_STALE_TURN_TIMEOUT_MS)) {
      return disconnectStaleTurn(eventStore);
    }

    await waitForNextPoll(abortSignal);
  }

  const replyState = getQuestionReplyState(state.lastObserved, questionTool);
  if (postState.failed) {
    return appendFailureMessage({
      sessionId,
      latestMessages: state.latestMessages,
      eventStore,
      failureMessage: postState.failureMessage,
    });
  }

  if (isFailedQuestionStatus(replyState?.status) || hasErrorParts(state.latestMessages)) {
    eventStore.push({ op: "replace", path: "/status", value: "failed" });
    return { code: 1 as number | null, signal: null as string | null };
  }

  const answeredMessages = markQuestionToolAnswered({ messages: state.latestMessages, questionTool, questionResponse });
  if (answeredMessages !== state.latestMessages) {
    eventStore.push({ op: "replace", path: "/messages", value: answeredMessages });
  }

  eventStore.push({ op: "replace", path: "/status", value: "completed" });
  return { code: 0 as number | null, signal: null as string | null };
};
