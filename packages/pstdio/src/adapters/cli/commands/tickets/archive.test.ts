import { describe, expect, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./archive";

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: null,
  display_title: "Test",
  file_id: null,
  priority: null,
  complexity: null,
  draft: false,
  archived: false,
  status_name: null,
  tag_names: [],
  created_at: "2026-03-04T00:00:00.000Z",
  ...overrides,
});

const makeDeps = (overrides: Record<string, unknown> = {}) => ({
  cwd: () => "/fake",
  resolveProjectId: (_cwd: string, explicitId?: string) => ({
    projectId: explicitId ?? "proj-1",
    root: "/fake",
  }),
  resolveTicketByShorthand: mock(async () => makeTicket()),
  updateTicket: mock(async () => ({ id: "t-1", archived: true })),
  log: mock(() => {}),
  ...overrides,
});

describe("tickets archive", () => {
  test("archives a ticket", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<{ id: string }>);

    expect(deps.updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", { archived: true });
    expect(deps.log).toHaveBeenCalledWith("Archived ticket PS-1");
  });

  test("throws when ticket not found", async () => {
    const deps = makeDeps({ resolveTicketByShorthand: mock(async () => null) });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-99" } as Arguments<{ id: string }>)).rejects.toThrow("Ticket not found: PS-99");
  });

  test("throws when ticket already archived", async () => {
    const deps = makeDeps({
      resolveTicketByShorthand: mock(async () => makeTicket({ archived: true })),
    });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-1" } as Arguments<{ id: string }>)).rejects.toThrow("Ticket already archived: PS-1");
  });

  test("uses --project-id when provided", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1", "project-id": "proj-1" } as Arguments<{ id: string; "project-id"?: string }>);

    expect(deps.updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", { archived: true });
  });

  test("throws when no project can be resolved", async () => {
    const deps = makeDeps({
      resolveProjectId: () => {
        throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      },
    });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-1" } as Arguments<{ id: string }>)).rejects.toThrow(
      "No project specified. Provide --project-id or run inside a linked project.",
    );
  });
});
