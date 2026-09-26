import type { SessionsRouteDeps } from "./deps";
import { getSessionHistory, SessionNotFoundError } from "./session-history";

export const getSessionMessages = async (sessionId: string, deps: SessionsRouteDeps) => {
  try {
    return (await getSessionHistory(sessionId, deps)).messages;
  } catch (error) {
    if (error instanceof SessionNotFoundError) return [];
    throw error;
  }
};
