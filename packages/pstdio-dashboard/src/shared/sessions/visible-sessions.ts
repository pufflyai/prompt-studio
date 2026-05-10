import type { Session } from "./session-types";

export const getVisibleSessions = (sessions: Session[]) => sessions.filter((session) => !session.archived);
