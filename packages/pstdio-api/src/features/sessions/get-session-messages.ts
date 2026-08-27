import { readFileSync } from "node:fs";
import type { FilePart, SessionMessage, SessionMessagePart, TextPart } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { buildMessagesFromPatches } from "./session-messages";
import { resolveSessionWorkspaceContext } from "./session-workspace-context";

const textParts = (message: SessionMessage) => message.parts.filter((part): part is TextPart => part.type === "text");

const fileParts = (message: SessionMessage) => message.parts.filter((part): part is FilePart => part.type === "file");

const messageText = (message: SessionMessage) =>
  textParts(message)
    .map((part) => part.text)
    .join("\n");

const matchSubmittedPromptText = (agentText: string, persistedText: string) => {
  if (!persistedText) return null;
  if (agentText === persistedText) return persistedText;
  if (agentText.trim() === persistedText.trim()) return persistedText;

  const manifestStart = `${persistedText}\n\n<session-attachments>`;
  if (agentText.startsWith(manifestStart)) return persistedText;

  return null;
};

const filePartKey = (part: FilePart) => part.fileId ?? part.url;

const mergeAttachmentParts = (
  agentMessage: SessionMessage,
  persistedMessage: SessionMessage,
  submittedText: string,
): SessionMessage => {
  const existingFileKeys = new Set(fileParts(agentMessage).map(filePartKey));
  const missingFileParts = fileParts(persistedMessage).filter((part) => !existingFileKeys.has(filePartKey(part)));
  const nonTextParts = agentMessage.parts.filter(
    (part): part is Exclude<SessionMessagePart, TextPart | FilePart> => part.type !== "text" && part.type !== "file",
  );

  return {
    ...agentMessage,
    parts: [{ type: "text", text: submittedText }, ...nonTextParts, ...fileParts(agentMessage), ...missingFileParts],
  };
};

const mergePersistedUserAttachmentParts = (
  agentMessages: SessionMessage[],
  persistedMessages: SessionMessage[],
): SessionMessage[] => {
  const persistedUserMessages = persistedMessages.filter(
    (message) => message.role === "user" && fileParts(message).length > 0,
  );
  let persistedIndex = 0;

  return agentMessages.map((message) => {
    if (message.role !== "user") return message;

    const persistedMessage = persistedUserMessages[persistedIndex];
    if (!persistedMessage) return message;

    const submittedText = matchSubmittedPromptText(messageText(message), messageText(persistedMessage));
    if (!submittedText) return message;

    persistedIndex += 1;
    return mergeAttachmentParts(message, persistedMessage, submittedText);
  });
};

export const getSessionMessages = async (sessionId: string, deps: SessionsRouteDeps): Promise<SessionMessage[]> => {
  const session = await deps.sessionService.get(sessionId);
  if (!session) return [];

  const persistedMessages = session.session_file_id ? await getPersistedMessages(session.session_file_id, deps) : [];
  const entry = deps.sessionService.store.get(sessionId);

  if (entry) {
    return buildMessagesFromPatches(entry.eventStore.getHistory(), persistedMessages);
  }

  if (session.agent && session.agent_session_id) {
    const agentMessages = await getAgentMessages(session, deps).catch(() => null);
    return agentMessages && agentMessages.length > 0
      ? mergePersistedUserAttachmentParts(agentMessages, persistedMessages)
      : persistedMessages;
  }

  return persistedMessages;
};

const getPersistedMessages = async (sessionFileId: string, deps: SessionsRouteDeps) => {
  const file = await deps.fileService.get(sessionFileId);
  if (!file) return [];

  return JSON.parse(readFileSync(file.storage_path, "utf-8")) as SessionMessage[];
};

const getAgentMessages = async (
  session: {
    id: string;
    agent: string | null;
    agent_session_id: string | null;
    cwd: string | null;
    project_id: string | null;
  },
  deps: SessionsRouteDeps,
) => {
  if (!session.agent_session_id) return null;

  const harness = await getSessionHarness(deps.harnessRegistry, session);
  if (!harness) return null;

  const workspace = deps.workspaceSessionService
    ? await resolveSessionWorkspaceContext(deps.workspaceSessionService, session.id, session.cwd ?? undefined)
    : undefined;

  return harness.getMessages(
    {
      agentSessionId: session.agent_session_id,
      cwd: session.cwd ?? undefined,
      workspace,
    },
    { projectId: session.project_id ?? undefined },
  );
};
