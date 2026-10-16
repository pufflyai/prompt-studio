import { expect, test } from "bun:test";
import type { ExtensionSessionQuery, ExtensionSessionSummary } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "./command-context.fixture";
import { ticketRelatedOpeningsCommand } from "./ticket-related-openings";

const session: ExtensionSessionSummary = {
  id: "latest",
  title: "Latest work",
  status: "completed",
  archived: false,
  agent: null,
  last_selected_model: null,
  workspace_id: null,
  original_session_id: null,
  created_at: "2026-10-15T10:00:00Z",
  updated_at: "2026-10-16T10:00:00Z",
  last_request_started: null,
  last_request_ended: null,
  anchors_json: [],
  usage: null,
};

test("ticket opening selects its latest non-archived linked session as a Side preview", async () => {
  const queries: (ExtensionSessionQuery | undefined)[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: { type: "ticket", id: "ticket-1" },
      sessions: {
        query: async (input) => {
          queries.push(input);
          return { items: [session], nextCursor: null };
        },
      },
    },
  });
  expect(await ticketRelatedOpeningsCommand.run(ctx, {})).toEqual([
    {
      resource: {
        type: "session",
        id: "latest",
        extensionId: "pstdio",
        projectId: "proj-1",
        label: "Latest work",
        icon: "MessageCircle",
      },
      autoOpen: true,
      region: "side",
      open: "preview",
    },
  ]);
  expect(queries).toEqual([
    {
      anchor: { type: "ticket", id: "ticket-1", extensionId: "pstdio-planner", projectId: "proj-1" },
      orderBy: "lastActivity",
      limit: 1,
    },
  ]);
});

test("tickets without a linked session have no automatic opening", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: { type: "ticket", id: "empty" },
      sessions: { query: async () => ({ items: [], nextCursor: null }) },
    },
  });
  expect(await ticketRelatedOpeningsCommand.run(ctx, {})).toEqual([]);
});

test("unrelated resource contexts do not query sessions", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: { type: "workspace", id: "workspace" },
      sessions: {
        query: async () => {
          throw new Error("unexpected session query");
        },
      },
    },
  });
  expect(await ticketRelatedOpeningsCommand.run(ctx, {})).toEqual([]);
});
