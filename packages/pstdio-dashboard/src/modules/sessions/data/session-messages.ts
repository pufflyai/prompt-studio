import { applySessionMessagePatch, type SessionMessage, type SessionMessagePatch } from "@pstdio/ui/chat-ui";

export { type SessionMessagePatch as DashboardSessionMessagePatch, visibleSessionMessages } from "@pstdio/ui/chat-ui";
export const applyDashboardSessionMessagePatch = (messages: SessionMessage[], patch: SessionMessagePatch) =>
  applySessionMessagePatch(messages, patch);
