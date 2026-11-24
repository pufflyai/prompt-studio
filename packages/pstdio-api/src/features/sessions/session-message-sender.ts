import type { SessionMessageSender, SessionMessageSource } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";

export const resolveMessageSender = async (
  deps: SessionsRouteDeps,
  projectId: string,
  source?: SessionMessageSource,
) => {
  if (!source) return undefined;
  if (source.type === "session") {
    const session =
      (await deps.sessionService.get(source.id)) ??
      (await deps.personalHistoryService.getSession(source.id, projectId));
    if (session?.project_id !== projectId) return undefined;
    return { type: "session", id: session.id, name: session.title || "Session" } satisfies SessionMessageSender;
  }
  const status = await deps.accountService.status();
  return {
    type: "user",
    id: status.login?.accountId ?? "local",
    name: status.login?.email ?? "Local user",
  } satisfies SessionMessageSender;
};
