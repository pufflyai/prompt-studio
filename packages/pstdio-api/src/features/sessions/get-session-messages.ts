import type { SessionsRouteDeps } from "./deps";
import { getSessionHistory } from "./session-history";

export const getSessionMessages = async (sessionId: string, deps: SessionsRouteDeps) =>
  (await getSessionHistory(sessionId, deps)).messages;
