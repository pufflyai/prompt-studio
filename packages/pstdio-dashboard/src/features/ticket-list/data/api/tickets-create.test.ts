import { afterEach, describe, expect, it, mock } from "bun:test";

import { createProjectTicket } from "./tickets";

const originalFetch = globalThis.fetch;

const statusesResponse = {
  items: [
    {
      id: "row-status-backlog",
      project_id: "project-1",
      item_id: "status-backlog",
      value_json: {
        id: "status-backlog",
        name: "Backlog",
        color: "gray",
        sortOrder: 0,
        isDefault: true,
      },
      created_at: "2026-03-19T00:00:00.000Z",
      updated_at: "2026-03-19T00:00:00.000Z",
    },
  ],
};

const ticketResponse = {
  id: "ticket-1",
  projectId: "project-1",
  shorthand: "PS-1",
  statusId: "status-backlog",
  displayTitle: "Create a tagged ticket",
  userPrompt: null,
  fileId: null,
  parentId: null,
  parallelizable: null,
  blockedReason: null,
  dependsOn: null,
  draft: false,
  archived: false,
  createdAt: "2026-03-19T00:00:00.000Z",
  updatedAt: "2026-03-19T00:00:00.000Z",
  tagNames: ["tag-bug"],
};

describe("createProjectTicket", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends tag_ids when tagIds are provided", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/v1/projects/project-1/extensions/pstdio.planner/collections/statuses")) {
        return new Response(JSON.stringify(statusesResponse), { status: 200 });
      }

      return new Response(JSON.stringify({ result: ticketResponse }), { status: 200 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await createProjectTicket({
      projectId: "project-1",
      content: "Create a tagged ticket",
      tagIds: ["tag-bug"],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:19840/v1/projects/project-1/extension-commands/pstdio.planner.createTicket/execute",
      expect.objectContaining({ method: "POST" }),
    );

    expect(fetchMock.mock.calls[1]?.[1]).toBeDefined();
    const requestInit = fetchMock.mock.calls[1]?.[1] as unknown as RequestInit;
    const payload = JSON.parse(String(requestInit.body));
    expect(payload.params).toEqual(
      expect.objectContaining({
        content: "Create a tagged ticket",
        tag_ids: ["tag-bug"],
      }),
    );
  });
});
