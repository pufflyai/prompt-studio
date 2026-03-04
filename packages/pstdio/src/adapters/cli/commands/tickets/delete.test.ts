import { describe, expect, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./delete";

const makeDeps = (overrides: Record<string, unknown> = {}) => ({
  cwd: () => "/fake",
  findGitRoot: () => "/fake",
  readConfig: () => ({ project_id: "proj-1" }),
  listTickets: mock(async () => [{ id: "t-1", shorthand: "PS-1", title: "Test" }]),
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
    const deps = makeDeps({ listTickets: mock(async () => []) });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-99" } as Arguments<{ id: string }>)).rejects.toThrow("Ticket not found: PS-99");
  });

  test("uses --project-id when provided", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1", "project-id": "proj-1" } as Arguments<{ id: string; "project-id"?: string }>);

    expect(deps.deleteTicket).toHaveBeenCalledWith(expect.any(String), "t-1");
    expect(deps.log).toHaveBeenCalledWith("Deleted ticket PS-1");
  });

  test("throws when no project can be resolved", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-1" } as Arguments<{ id: string }>)).rejects.toThrow(
      "No project specified. Provide --project-id or run inside a linked project.",
    );
  });

  test("skips local dir removal when not inside a linked project", async () => {
    const deps = makeDeps({
      findGitRoot: () => null,
      readConfig: () => null,
      removeTicketDir: mock(() => false),
    });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1", "project-id": "proj-1" } as Arguments<{ id: string; "project-id"?: string }>);

    expect(deps.removeTicketDir).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith("Deleted ticket PS-1");
  });
});
