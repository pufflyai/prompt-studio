import { toExtensionSessionDetails } from "./extension-session";

type Session = Parameters<typeof toExtensionSessionDetails>[0];
export const toSessionResponse = (session: Session, workspaceId: string | null = null) => ({
  ...session,
  ...toExtensionSessionDetails(session, workspaceId),
});
