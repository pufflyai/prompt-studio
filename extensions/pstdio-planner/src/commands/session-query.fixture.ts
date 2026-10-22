import type { ExtensionSessionsApi } from "@pstdio/sdk/extensions";
import { sessionRecord } from "./session-record.fixture";

type Session = Parameters<typeof sessionRecord>[0];

export const sessionQuery =
  (
    all: () => Promise<Session[]>,
    byWorkspace?: (workspaceId: string) => Promise<Session[]>,
  ): ExtensionSessionsApi["query"] =>
  async (input) => {
    const matching = [...(await (input?.workspaceId && byWorkspace ? byWorkspace(input.workspaceId) : all()))]
      .reverse()
      .filter((session) => !input?.status || input.status.includes(session.status))
      .map((session) =>
        sessionRecord({
          workspaceId: input?.workspaceId ?? null,
          workspace_id: input?.workspaceId ?? null,
          ...session,
        }),
      );
    const start = Number(input?.cursor ?? 0);
    const end = start + (input?.limit ?? matching.length);
    return { items: matching.slice(start, end), nextCursor: end < matching.length ? String(end) : null };
  };
