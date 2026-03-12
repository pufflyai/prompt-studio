import type { Session } from "../types";

export const getVisibleSessions = (sessions: Session[]) => sessions.filter((session) => !session.archived);
