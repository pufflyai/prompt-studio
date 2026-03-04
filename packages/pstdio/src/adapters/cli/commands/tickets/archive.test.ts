import { describe, expect, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./archive";

const makeDeps = (overrides: Record<string, unknown> = {}) => ({
  cwd: () => "/fake",
  findGitRoot: () => "/fake",
  readConfig: () => ({ project_id: "proj-1" }),
  listTickets: mock(async () => [{ id: "t-1", shorthand: "PS-1", title: "Test", archived: false }]),
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
    const deps = makeDeps({ listTickets: mock(async () => []) });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-99" } as Arguments<{ id: string }>)).rejects.toThrow("Ticket not found: PS-99");
  });

  test("throws when ticket already archived", async () => {
    const deps = makeDeps({
      listTickets: mock(async () => [{ id: "t-1", shorthand: "PS-1", archived: true }]),
    });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-1" } as Arguments<{ id: string }>)).rejects.toThrow("Ticket already archived: PS-1");
  });

  test("uses --project-id when provided", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1", "project-id": "proj-1" } as Arguments<{ id: string; "project-id"?: string }>);

    expect(deps.updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", { archived: true });
  });

  test("throws when no project can be resolved", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps as never);

    expect(handler({ id: "PS-1" } as Arguments<{ id: string }>)).rejects.toThrow(
      "No project specified. Provide --project-id or run inside a linked project.",
    );
  });
});
