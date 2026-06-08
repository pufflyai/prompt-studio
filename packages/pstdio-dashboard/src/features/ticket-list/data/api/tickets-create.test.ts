import { afterEach, describe, expect, it, mock } from "bun:test";

import { createProjectTicket } from "./tickets";

const originalFetch = globalThis.fetch;

const statusesResponse = [
  {
    id: "backlog",
    name: "Backlog",
    color: "gray",
    sortOrder: 0,
    isDefault: true,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
];

const ticketResponse = {
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Create a tagged ticket",
  content: "Create a tagged ticket",
  statusId: "backlog",
  parentId: null,
  blockedReason: null,
  dependsOn: null,
  draft: false,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-03-19T00:00:00.000Z",
  updatedAt: "2026-03-19T00:00:00.000Z",
  tagIds: ["tag-bug"],
};

describe("createProjectTicket", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends tagIds when tagIds are provided", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/v1/projects/project-1/extensions/commands/pstdio-planner.ticketStatus.read/execute")) {
        return new Response(JSON.stringify({ outcome: { ok: true, value: { statuses: statusesResponse } } }), {
          status: 200,
        });
      }

      return new Response(JSON.stringify({ outcome: { ok: true, value: ticketResponse } }), { status: 200 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await createProjectTicket({
      projectId: "project-1",
      content: "Create a tagged ticket",
      tagIds: ["tag-bug"],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/v1/projects/project-1/extensions/commands/pstdio-planner.create-ticket/execute",
      expect.objectContaining({ method: "POST" }),
    );

    expect(fetchMock.mock.calls[1]?.[1]).toBeDefined();
    const requestInit = fetchMock.mock.calls[1]?.[1] as unknown as RequestInit;
    const payload = JSON.parse(String(requestInit.body));
    expect(payload).toEqual(
      expect.objectContaining({
        params: {
          content: "Create a tagged ticket",
          tagIds: ["tag-bug"],
        },
      }),
    );
  });
});
