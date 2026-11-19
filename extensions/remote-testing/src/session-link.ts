import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

// A host session resource, so tables and commands can open the session that started a run.
export async function sessionResource(ctx: ExtensionContextBase, sessionId: string) {
  const session = await ctx.sessions.get(sessionId).catch(() => null);
  if (!session) return null;
  return {
    type: "session",
    extensionId: "pstdio",
    projectId: ctx.projectId,
    id: session.id,
    label: session.title,
  };
}
