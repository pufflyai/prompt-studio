import { afterEach, describe, expect, it, mock } from "bun:test";

import { createProjectTicket } from "./tickets";

const originalFetch = globalThis.fetch;

const statusesResponse = [
  {
    id: "status-backlog",
    name: "Backlog",
    color: "gray",
    sort_order: 0,
    is_default: true,
  },
];

const ticketResponse = {
  id: "ticket-1",
  shorthand: "PS-1",
  project_id: "project-1",
  status_id: "status-backlog",
  status_name: "Backlog",
  display_title: "Create a tagged ticket",
  user_prompt: null,
  file_id: null,
  parent_id: null,
  parallelizable: null,
  blocked_reason: null,
  depends_on: null,
  draft: false,
  archived: false,
  deleted_at: null,
  created_at: "2026-03-19T00:00:00.000Z",
  updated_at: "2026-03-19T00:00:00.000Z",
  tag_ids: ["tag-bug"],
  tag_names: ["bug"],
};

describe("createProjectTicket", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends tag_ids when tagIds are provided", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/v1/projects/project-1/ticket-statuses")) {
        return new Response(JSON.stringify(statusesResponse), { status: 200 });
      }

      return new Response(JSON.stringify(ticketResponse), { status: 200 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await createProjectTicket({
      projectId: "project-1",
      content: "Create a tagged ticket",
      tagIds: ["tag-bug"],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/tickets", expect.objectContaining({ method: "POST" }));

    expect(fetchMock.mock.calls[1]?.[1]).toBeDefined();
    const requestInit = fetchMock.mock.calls[1]?.[1] as unknown as RequestInit;
    const payload = JSON.parse(String(requestInit.body));
    expect(payload).toEqual(
      expect.objectContaining({
        project_id: "project-1",
        content: "Create a tagged ticket",
        tag_ids: ["tag-bug"],
      }),
    );
  });
});
