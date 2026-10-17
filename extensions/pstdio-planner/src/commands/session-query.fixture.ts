import type { ExtensionSessionSummary, ExtensionSessionsApi } from "@pstdio/sdk/extensions";

type Session = Pick<ExtensionSessionSummary, "id" | "title" | "status"> & Partial<ExtensionSessionSummary>;

export const sessionQuery =
  (
    all: () => Promise<Session[]>,
    byWorkspace?: (workspaceId: string) => Promise<Session[]>,
  ): ExtensionSessionsApi["query"] =>
  async (input) => ({
    items: [...(await (input?.workspaceId && byWorkspace ? byWorkspace(input.workspaceId) : all()))]
      .reverse()
      .map((session) => ({
        archived: false,
        agent: null,
        last_selected_model: null,
        workspace_id: input?.workspaceId ?? null,
        original_session_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_request_started: null,
        last_request_ended: null,
        anchors_json: [],
        usage: null,
        ...session,
      })),
    nextCursor: null,
  });
