import type { HarnessResumeInput, QuestionResponse } from "@pstdio/sdk/extensions";
import { pollOpencodeQuestionReply } from "./opencode-question-reply-poller";
import type { createOpencodeService } from "./opencode-service";
import { toHarnessSession } from "./opencode-session-handle";

export const resumeOpencodeQuestion = async (options: {
  opencode: ReturnType<typeof createOpencodeService>;
  input: HarnessResumeInput;
  questionResponse: QuestionResponse;
  signal: AbortSignal;
  pollIntervalMs?: number;
  onHistoryRecovery: () => void;
}) => {
  const { opencode, input, questionResponse, signal } = options;
  const pendingQuestions = await opencode.listPendingQuestions(input.agentSessionId, input.cwd);
  const pendingQuestion = pendingQuestions.find(
    (question) =>
      question.sessionID === input.agentSessionId &&
      (!questionResponse.callId || question.tool?.callID === questionResponse.callId),
  );
  if (!pendingQuestion)
    throw Object.assign(new Error("OpenCode pending question request not found."), { questionRejected: true });
  const messageComplete = opencode.replyQuestion(
    input.agentSessionId,
    pendingQuestion.id,
    questionResponse.answers,
    input.cwd,
    signal,
  );
  const abortController = new AbortController();
  const done = pollOpencodeQuestionReply({
    loadMessages: opencode.getSessionMessages,
    sessionId: input.agentSessionId,
    cwd: input.cwd,
    events: input.events,
    onHistoryRecovery: options.onHistoryRecovery,
    questionTool: pendingQuestion.tool,
    questionResponse,
    messageComplete,
    abortSignal: abortController.signal,
    pollIntervalMs: options.pollIntervalMs,
  });
  return toHarnessSession({
    agentSessionId: input.agentSessionId,
    abortController,
    abortSession: () => opencode.abortSession(input.agentSessionId, input.cwd),
    done,
  });
};
