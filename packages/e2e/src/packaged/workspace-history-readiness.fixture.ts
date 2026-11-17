interface ForeignHistoryInput {
  sessionId: string;
  deviceId: string;
  readSessions: (workspaceId?: string) => Promise<{ items: { id: string }[] }>;
  readWorkspaces: () => Promise<{ items: { id: string; device?: { id: string } | null }[] }>;
}

export const waitForForeignWorkspaceHistory = async (input: ForeignHistoryInput) => {
  while (!(await input.readSessions()).items.some((session) => session.id === input.sessionId)) await Bun.sleep(25);
  let workspace: Awaited<ReturnType<ForeignHistoryInput["readWorkspaces"]>>["items"][number] | undefined;
  while (!workspace) {
    workspace = (await input.readWorkspaces()).items.find((row) => row.device?.id === input.deviceId);
    if (!workspace) await Bun.sleep(25);
  }
  // Session records and their shared workspace links arrive independently.
  while (!(await input.readSessions(workspace.id)).items.some((session) => session.id === input.sessionId))
    await Bun.sleep(25);
  return workspace;
};
