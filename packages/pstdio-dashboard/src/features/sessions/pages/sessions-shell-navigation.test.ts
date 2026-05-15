import { describe, expect, it } from "bun:test";
import { resolveSessionIndicatorColor } from "@pstdio/ui";
import type { Session } from "../types";
import { createSessionsNavigationSections } from "./sessions-shell-navigation";

describe("createSessionsNavigationSections", () => {
  it("keeps the empty state in the shell navigation tree", () => {
    const sections = createSessionsNavigationSections({
      projectId: "project-1",
      sessions: [],
      onArchiveSession: () => undefined,
      onCreateSession: () => undefined,
    });

    expect(sections[0]?.nodes.map((node) => node.label)).toEqual(["New session", "No sessions yet"]);
    expect(sections[0]?.nodes[1]).toMatchObject({
      id: "sessions:empty",
      disabled: true,
    });
  });

  it("keeps session status icons in the shell navigation tree without status subtitles", () => {
    const sections = createSessionsNavigationSections({
      projectId: "project-1",
      sessions: [
        {
          id: "session-1",
          projectId: "project-1",
          agentSessionId: null,
          title: "Implement tickets",
          status: "failed",
          archived: false,
          agent: null,
          lastSelectedModel: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        } satisfies Session,
      ],
      onArchiveSession: () => undefined,
      onCreateSession: () => undefined,
    });

    const sessionNode = sections[1]?.nodes[0] as {
      description?: unknown;
      iconElement?: unknown;
      iconColor?: unknown;
      iconTooltip?: unknown;
    };

    expect(sessionNode.description).toBeUndefined();
    expect(sessionNode.iconElement).toBeDefined();
    expect(sessionNode.iconColor).toBe(resolveSessionIndicatorColor("failed"));
    expect(sessionNode.iconTooltip).toBeDefined();
  });

  it("keeps session resource context menu actions in the shell navigation tree", () => {
    const sections = createSessionsNavigationSections({
      projectId: "project-1",
      sessions: [
        {
          id: "session-1",
          projectId: "project-1",
          agentSessionId: null,
          title: "Implement tickets",
          status: "completed",
          archived: false,
          agent: null,
          lastSelectedModel: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        } satisfies Session,
      ],
      resolveSessionContextMenuActions: (session) => [
        {
          id: `resource-action:${session.id}`,
          label: "Run resource action",
          run: () => undefined,
        },
      ],
      onArchiveSession: () => undefined,
      onCreateSession: () => undefined,
    });

    expect(sections[1]?.nodes[0]?.contextMenuActions).toEqual([
      {
        id: "resource-action:session-1",
        label: "Run resource action",
        run: expect.any(Function),
      },
    ]);
  });
});
