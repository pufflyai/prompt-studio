import { describe, expect, test } from "bun:test";
import { createPlannerTicketApi } from "./planner-tickets";

const ticketValue = {
  id: "PS-1",
  projectId: "proj-1",
  shorthand: "PS-1",
  createdAt: "2026-04-28T10:00:00.000Z",
  updatedAt: "2026-04-28T11:00:00.000Z",
  draft: false,
  archived: false,
  fileId: "PS-1:ticket",
  parentId: null,
  userPrompt: null,
  dependsOn: null,
  parallelizable: null,
  blockedReason: null,
  tagNames: ["bug"],
  content: "# Fix login\n\nBody",
  displayTitle: "Fix login",
  statusId: "todo",
  files: [],
};

describe("planner ticket API", () => {
  test("lists planner tickets from extension collection rows", async () => {
    const paths: string[] = [];
    const request = async <T>(path: string) => {
      paths.push(path);
      if (path.endsWith("/collections/statuses")) {
        return { items: [{ item_id: "todo", value_json: { id: "todo", name: "Todo" } }] } as T;
      }

      return { items: [{ item_id: "PS-1", value_json: ticketValue }] } as T;
    };
    const api = createPlannerTicketApi(request);

    const tickets = await api.list({ project_id: "proj-1", status: "Todo", tag: ["bug"] });

    expect(paths).toEqual([
      "/v1/projects/proj-1/extensions/pstdio.planner/collections/tickets",
      "/v1/projects/proj-1/extensions/pstdio.planner/collections/statuses",
    ]);
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      shorthand: "PS-1",
      display_title: "Fix login",
      status_name: "Todo",
      tag_names: ["bug"],
    });
  });

  test("gets planner ticket details by shorthand", async () => {
    const request = async <T>() => ({ items: [{ item_id: "PS-1", value_json: ticketValue }] }) as T;
    const api = createPlannerTicketApi(request);

    const ticket = await api.get("proj-1", "PS-1");

    expect(ticket).toMatchObject({
      shorthand: "PS-1",
      content: "# Fix login\n\nBody",
      updated_at: "2026-04-28T11:00:00.000Z",
    });
  });
});
