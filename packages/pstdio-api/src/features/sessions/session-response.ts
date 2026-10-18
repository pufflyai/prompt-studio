import { toExtensionSession } from "./extension-session";

type Session = Parameters<typeof toExtensionSession>[0];
export const toSessionResponse = (session: Session, workspaceId: string | null = null) => ({
  ...session,
  ...toExtensionSession(session, workspaceId),
  projectId: session.project_id,
  agentSessionId: session.agent_session_id,
  sessionFileId: session.session_file_id,
  params: session.params_json,
});
