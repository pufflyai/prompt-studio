import type { EventStore, SessionMessage } from "../../types";
import {
  appendFailureMessage,
  cancelTurn,
  disconnectStaleTurn,
  hasErrorParts,
  OPENCODE_STALE_TURN_TIMEOUT_MS,
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
  let lastSnapshot = "";
  let latestMessages: SessionMessage[] = [];
  let lastObserved: OpencodeSessionMessage[] = [];
  let lastProgressAt: number | null = null;
  let terminalSnapshot: string | null = null;
  let settledIdleSince: number | null = null;
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
    if (lastProgressAt === null || snapshot.snapshotChanged) {
      lastProgressAt = now;
    }

    const replyState = getQuestionReplyState(lastObserved, questionTool);
    const questionTerminal = isTerminalQuestionStatus(replyState?.status);
    const inFlight = isTurnInFlight(lastObserved);
    const quietAfterTerminalSnapshot =
      questionTerminal &&
      !inFlight &&
      terminalSnapshot !== null &&
      terminalSnapshot === lastSnapshot &&
      !snapshot.snapshotChanged;

    if (quietAfterTerminalSnapshot) {
      break;
    }

    const settledWithNoTurnInFlight = postState.settled && !postState.timedOut && !postState.failed && !inFlight;
    const quietAfterSettledIdleSnapshot =
      settledWithNoTurnInFlight &&
      settledIdleSince !== null &&
      !snapshot.snapshotChanged &&
      now - settledIdleSince >= OPENCODE_QUESTION_REPLY_IDLE_GRACE_MS;

    if (quietAfterSettledIdleSnapshot) {
      break;
    }

    if (questionTerminal && !inFlight) {
      terminalSnapshot = lastSnapshot;
    } else {
      terminalSnapshot = null;
    }

    if (settledWithNoTurnInFlight) {
      settledIdleSince = snapshot.snapshotChanged || settledIdleSince === null ? now : settledIdleSince;
    } else {
      settledIdleSince = null;
    }

    if (postState.failed) {
      return appendFailureMessage({
        sessionId,
        latestMessages,
        eventStore,
        failureMessage: postState.failureMessage,
      });
    }

    if (isTurnStale(lastProgressAt, now, OPENCODE_STALE_TURN_TIMEOUT_MS)) {
      return disconnectStaleTurn(eventStore);
    }

    await waitForNextPoll(abortSignal);
  }

  const replyState = getQuestionReplyState(lastObserved, questionTool);
  if (postState.failed || isFailedQuestionStatus(replyState?.status) || hasErrorParts(latestMessages)) {
    if (postState.failed) {
      return appendFailureMessage({
        sessionId,
        latestMessages,
        eventStore,
        failureMessage: postState.failureMessage,
      });
    }

    eventStore.push({ op: "replace", path: "/status", value: "failed" });
    return { code: 1 as number | null, signal: null as string | null };
  }

  const answeredMessages = markQuestionToolAnswered({ messages: latestMessages, questionTool, questionResponse });
  if (answeredMessages !== latestMessages) {
    eventStore.push({ op: "replace", path: "/messages", value: answeredMessages });
  }

  eventStore.push({ op: "replace", path: "/status", value: "completed" });
  return { code: 0 as number | null, signal: null as string | null };
};
