import type { SessionMessage } from "@pstdio/sdk/extensions";

// Older clients did not persist shared item identity. See ADR 0053.
export const nativeHistoryAfterLegacyBoundary = (
  known: readonly SessionMessage[],
  native: readonly SessionMessage[],
) => {
  const legacy =
    known.some((message) => /^(?:codex-\d+-|rollout-)/.test(message.id)) ||
    native.some((message) => /-item-\d+$/.test(message.id));
  if (!legacy) return native;
  const identities = new Set(known.map((message) => message.id));
  const anchor = native.findIndex((message) => identities.has(message.id));
  if (anchor >= 0) return native.slice(anchor);
  const savedTurns = known.filter((message) => message.role === "user").length;
  let turns = 0;
  const boundary = native.findIndex((message) => message.role === "user" && ++turns > savedTurns);
  return boundary >= 0 ? native.slice(boundary) : [];
};
