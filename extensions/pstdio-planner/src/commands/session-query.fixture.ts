import type { ExtensionSessionsApi } from "@pstdio/sdk/extensions";
import { sessionRecord } from "./session-record.fixture";

type Session = Parameters<typeof sessionRecord>[0];

export const sessionQuery =
  (
    all: () => Promise<Session[]>,
    byWorkspace?: (workspaceId: string) => Promise<Session[]>,
  ): ExtensionSessionsApi["query"] =>
  async (input) => ({
    items: [...(await (input?.workspaceId && byWorkspace ? byWorkspace(input.workspaceId) : all()))]
      .reverse()
      .map((session) =>
        sessionRecord({
          workspaceId: input?.workspaceId ?? null,
          workspace_id: input?.workspaceId ?? null,
          ...session,
        }),
      ),
    nextCursor: null,
  });
