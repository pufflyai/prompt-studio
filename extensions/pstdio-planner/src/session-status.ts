const liveSessionStatuses = new Set(["queued", "in_progress", "awaiting_input"]);

export const isLiveSessionStatus = (status: string) => liveSessionStatuses.has(status);
