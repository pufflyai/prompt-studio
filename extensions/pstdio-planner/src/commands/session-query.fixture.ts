import type { ExtensionSessionsApi } from "@pstdio/sdk/extensions";

import { createSessionResource } from "./session.fixture";

type SessionRecord = Awaited<ReturnType<ExtensionSessionsApi["create"]>>;
type Session = Pick<SessionRecord, "id" | "title" | "status"> & Partial<SessionRecord>;

export const sessionQuery =
  (
    all: () => Promise<Session[]>,
    byWorkspace?: (workspaceId: string) => Promise<Session[]>,
  ): ExtensionSessionsApi["query"] =>
  async (input) => ({
    items: [...(await (input?.workspaceId && byWorkspace ? byWorkspace(input.workspaceId) : all()))]
      .reverse()
      .map((session) =>
        createSessionResource({
          workspaceId: input?.workspaceId ?? null,
          workspace_id: input?.workspaceId ?? null,
          ...session,
        }),
      ),
    nextCursor: null,
  });
