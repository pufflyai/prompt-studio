import type { SessionStatus } from "../types";

export const canStopSession = (status: SessionStatus | null) => status === "in_progress" || status === "awaiting_input";
