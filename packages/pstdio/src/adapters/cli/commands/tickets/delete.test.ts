import { describe, expect, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./delete";

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
    root: "/fake" as string | null,
  }),
  resolveTicketByShorthand: mock(async () => makeTicket()),
  deleteTicket: mock(async () => ({ id: "t-1", shorthand: "PS-1", deleted_at: "2026-01-01" })),
  removeTicketDir: mock(() => true),
  log: mock(() => {}),
  ...overrides,
});

describe("tickets delete", () => {
  test("deletes ticket and removes local dir", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<{ id: string }>);

    expect(deps.deleteTicket).toHaveBeenCalledWith(expect.any(String), "t-1");
    expect(deps.removeTicketDir).toHaveBeenCalledWith("/fake", "PS-1");
    expect(deps.log).toHaveBeenCalledWith("Deleted ticket PS-1");
  });

  test("throws when ticket not found", async () => {
    const deps = makeDeps({ resolveTicketByShorthand: mock(async () => null) });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-99" } as Arguments<{ id: string }>)).rejects.toThrow("Ticket not found: PS-99");
  });

  test("uses --project-id when provided", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1", "project-id": "proj-1" } as Arguments<{ id: string; "project-id"?: string }>);

    expect(deps.deleteTicket).toHaveBeenCalledWith(expect.any(String), "t-1");
    expect(deps.log).toHaveBeenCalledWith("Deleted ticket PS-1");
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

  test("skips local dir removal when root is null", async () => {
    const deps = makeDeps({
      resolveProjectId: (_cwd: string, explicitId?: string) => ({
        projectId: explicitId ?? "proj-1",
        root: null,
      }),
    });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1", "project-id": "proj-1" } as Arguments<{ id: string; "project-id"?: string }>);

    expect(deps.removeTicketDir).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith("Deleted ticket PS-1");
  });
});
