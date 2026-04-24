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

export const pollOpencodeQuestionReply = async (input: {
  loadMessages: SessionMessagesLoader;
  sessionId: string;
  cwd: string | undefined;
  eventStore: EventStore;
  questionTool?: QuestionToolRef;
  messageComplete: Promise<void>;
  abortSignal?: AbortSignal;
}) => {
  const { loadMessages, sessionId, cwd, eventStore, questionTool, messageComplete, abortSignal } = input;
  let lastSnapshot = "";
  let latestMessages: SessionMessage[] = [];
  let lastObserved: OpencodeSessionMessage[] = [];
  let lastProgressAt: number | null = null;
  let terminalSnapshot: string | null = null;
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

    if (questionTerminal && !inFlight) {
      terminalSnapshot = lastSnapshot;
    } else {
      terminalSnapshot = null;
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

  eventStore.push({ op: "replace", path: "/status", value: "completed" });
  return { code: 0 as number | null, signal: null as string | null };
};
