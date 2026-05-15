import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { getSessionSwitchDiagnosticNow, recordSessionSwitchStep } from "./session-switch-diagnostics";

export const recordConversationCacheStep = (input: {
  sessionId: string;
  cachedMessageCount: number;
  connectionAttempt: number;
}) => {
  recordSessionSwitchStep({
    sessionId: input.sessionId,
    step: "conversation.cache",
    metadata: {
      cachedMessageCount: input.cachedMessageCount,
      connectionAttempt: input.connectionAttempt,
    },
  });
};

export const createConversationHydrationTracker = (sessionId: string) => {
  const startedAt = getSessionSwitchDiagnosticNow();
  recordSessionSwitchStep({ sessionId, step: "conversation.hydrate.start" });

  return {
    finish: (hydrated: SessionMessage[] | null) => {
      recordSessionSwitchStep({
        sessionId,
        step: "conversation.hydrate.end",
        durationMs: getSessionSwitchDiagnosticNow() - startedAt,
        metadata: { loaded: hydrated !== null, messageCount: hydrated?.length ?? 0 },
      });
    },
  };
};

export const recordConversationStreamOpenStep = (sessionId: string, connectionAttempt: number) => {
  recordSessionSwitchStep({ sessionId, step: "conversation.stream.open", metadata: { connectionAttempt } });
};

export const recordConversationStreamReadyStep = (sessionId: string, connectionAttempt: number) => {
  recordSessionSwitchStep({ sessionId, step: "conversation.stream.ready", metadata: { connectionAttempt } });
};

export const recordConversationStreamFirstPatchStep = (sessionId: string, messages: SessionMessage[]) => {
  recordSessionSwitchStep({
    sessionId,
    step: "conversation.stream.first-patch",
    metadata: { messageCount: messages.length },
  });
};

export const recordConversationStreamEndStep = (sessionId: string) => {
  recordSessionSwitchStep({ sessionId, step: "conversation.stream.end" });
};

export const recordConversationStreamErrorStep = (input: {
  sessionId: string;
  retryDelayMs: number;
  retryCount: number;
}) => {
  recordSessionSwitchStep({
    sessionId: input.sessionId,
    step: "conversation.stream.error",
    metadata: { retryDelayMs: input.retryDelayMs, retryCount: input.retryCount },
  });
};
