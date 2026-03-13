import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { apiRequest } from "@/lib/api";
import type { Session } from "../types";

const normalizeForFileName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

interface SessionConversationResponse {
  messages: SessionMessage[];
}

export const buildSessionDownload = (session: Session, messages: SessionMessage[]) => {
  const normalizedTitle = normalizeForFileName(session.title);
  const fileNamePrefix = normalizedTitle.length > 0 ? normalizedTitle : "session";
  const payload = {
    session,
    messages,
  };

  return {
    fileName: `${fileNamePrefix}-${session.id}.json`,
    content: JSON.stringify(payload, null, 2),
  };
};

export const downloadSessionJson = async (session: Session) => {
  const response = await apiRequest<SessionConversationResponse>(`/v1/sessions/${session.id}/conversation`);
  const download = buildSessionDownload(session, response.messages);
  const blob = new Blob([download.content], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = href;
  anchor.download = download.fileName;
  anchor.click();
  URL.revokeObjectURL(href);
};
