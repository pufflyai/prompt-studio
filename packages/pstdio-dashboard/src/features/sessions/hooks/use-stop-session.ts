import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { stopSession } from "./stop-session";

export const useStopSession = () => {
  const requestedStopSessionIdsRef = useRef(new Set<string>());
  const [requestedStopSessionIds, setRequestedStopSessionIds] = useState(() => new Set<string>());

  const markSessionAsRequested = (sessionId: string) => {
    if (requestedStopSessionIdsRef.current.has(sessionId)) {
      return false;
    }

    requestedStopSessionIdsRef.current.add(sessionId);
    setRequestedStopSessionIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(sessionId);
      return nextIds;
    });
    return true;
  };

  const clearRequestedSession = (sessionId: string) => {
    requestedStopSessionIdsRef.current.delete(sessionId);
    setRequestedStopSessionIds((currentIds) => {
      if (!currentIds.has(sessionId)) {
        return currentIds;
      }

      const nextIds = new Set(currentIds);
      nextIds.delete(sessionId);
      return nextIds;
    });
  };

  const mutation = useMutation({
    mutationFn: stopSession,
    onSettled: (_data, _error, sessionId) => {
      clearRequestedSession(sessionId);
    },
  });

  const requestStopSession = (sessionId: string) => {
    if (!markSessionAsRequested(sessionId)) {
      return;
    }

    mutation.mutate(sessionId);
  };

  const hasRequestedStop = (sessionId: string) => requestedStopSessionIds.has(sessionId);

  return {
    ...mutation,
    requestStopSession,
    hasRequestedStop,
  };
};
