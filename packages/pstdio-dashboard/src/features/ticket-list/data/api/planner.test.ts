import { afterEach, describe, expect, it, mock } from "bun:test";

import { type PlannerTicket, readPlannerTickets } from "./planner";

const originalFetch = globalThis.fetch;

const createdAt = "2026-06-08T10:00:00.000Z";
const updatedAt = "2026-06-08T10:05:00.000Z";

const makeTicket = (id: string, shorthand: string): PlannerTicket => ({
  id,
  shorthand,
  title: "Ticket",
  content: "Ticket body",
  statusId: null,
  tagIds: [],
  attachments: [],
  files: [],
  archived: false,
  sortOrder: 0,
  createdAt,
  updatedAt,
});

const plannerResponse = (value: unknown) =>
  new Response(JSON.stringify({ outcome: { ok: true, status: "success", value } }), { status: 200 });

const bodyAsJson = (body: BodyInit | null | undefined) => JSON.parse(String(body));

describe("planner ticket api", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads ticket list records through a single bulk planner command", async () => {
    const tickets = [makeTicket("ticket-1", "T-1"), makeTicket("ticket-2", "T-2")];
    const requestedCommands: string[] = [];

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requestedCommands.push(url);

      if (url.endsWith("/v1/projects/project-1/extensions/commands/pstdio-planner.read-tickets/execute")) {
        expect(bodyAsJson(init?.body).params).toEqual({});
        return plannerResponse(tickets);
      }

      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    await expect(readPlannerTickets("project-1")).resolves.toEqual(tickets);
    expect(requestedCommands).toHaveLength(1);
  });
});
