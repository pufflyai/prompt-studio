import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useRef } from "react";
import { type PendingFollowUpState, shouldClearPendingFollowUp } from "./session-chat-state";
import {
  countCompletedEditActions,
  shouldReconnectForExternalResume,
  shouldResetPendingFollowUpForSession,
} from "./session-chat-view.utils";

export const useResetEditCountOnSessionChange = (sessionId: string | null, editCountRef: { current: number }) => {
  const lastSessionIdRef = useRef<string | null>(sessionId);

  useEffect(() => {
    if (lastSessionIdRef.current === sessionId) {
      return;
    }

    lastSessionIdRef.current = sessionId;
    editCountRef.current = 0;
  }, [sessionId, editCountRef]);
};

export const useReconnectWhenWorkspaceReady = (isWorkspaceInitializing: boolean, reconnect: () => void) => {
  const wasInitializingRef = useRef(false);

  useEffect(() => {
    if (wasInitializingRef.current && !isWorkspaceInitializing) {
      reconnect();
    }

    wasInitializingRef.current = isWorkspaceInitializing;
  }, [isWorkspaceInitializing, reconnect]);
};

export const useEditActionNotifier = (
  messages: SessionMessage[],
  onEditAction: (() => void) | undefined,
  editCountRef: { current: number },
) => {
  useEffect(() => {
    if (!onEditAction) {
      return;
    }

    const nextCount = countCompletedEditActions(messages);
    if (nextCount <= editCountRef.current) {
      return;
    }

    editCountRef.current = nextCount;
    onEditAction();
  }, [messages, onEditAction, editCountRef]);
};

export const useReconnectOnExternalResume = (
  sessionStatus: string | null,
  isStreaming: boolean,
  reconnect: () => void,
) => {
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = sessionStatus;

    if (shouldReconnectForExternalResume(prevStatus, sessionStatus, isStreaming)) {
      reconnect();
    }
  }, [sessionStatus, isStreaming, reconnect]);
};

export const useSyncPendingFollowUp = (input: {
  messages: SessionMessage[];
  pendingFollowUp: PendingFollowUpState | null;
  sessionId: string | null;
  setPendingFollowUp: (value: PendingFollowUpState | null) => void;
}) => {
  const { messages, pendingFollowUp, sessionId, setPendingFollowUp } = input;

  useEffect(() => {
    if (shouldClearPendingFollowUp(pendingFollowUp, messages)) {
      setPendingFollowUp(null);
    }
  }, [messages, pendingFollowUp, setPendingFollowUp]);

  useEffect(() => {
    if (shouldResetPendingFollowUpForSession(pendingFollowUp, sessionId)) {
      setPendingFollowUp(null);
    }
  }, [pendingFollowUp, sessionId, setPendingFollowUp]);
};
