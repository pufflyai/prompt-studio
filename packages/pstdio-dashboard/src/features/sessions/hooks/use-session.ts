import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../../lib/api";
import type { SessionStatus } from "../types";

type SessionStatusResponse = {
  status: SessionStatus;
  archived: boolean;
};

const getSessionStatus = (sessionId: string) =>
  apiRequest<SessionStatusResponse>(`/v1/sessions/${sessionId}`).then((session) => ({
    status: session.status,
    archived: session.archived,
  }));

export const useSession = (sessionId: string | null) =>
  useQuery({
    queryKey: ["session", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => getSessionStatus(sessionId as string),
  });
