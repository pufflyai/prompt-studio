import { describe, expect, mock, test } from "bun:test";
import { createTicketService } from "./ticket-service";

const buildDeps = () => {
  const ticketsDb = {
    softDelete: mock(async (id: string) => ({
      id,
      shorthand: "T-1",
      project_id: "project_1",
      deleted_at: new Date().toISOString(),
    })),
    create: mock(async (input: Record<string, unknown>) => ({
      id: "ticket_1",
      shorthand: "T-1",
      project_id: input.project_id,
    })),
    update: mock(async (id: string, _input: Record<string, unknown>) => ({
      id,
      shorthand: "T-1",
      project_id: "project_1",
      status_id: "status_1",
    })),
    get: mock(async () => null),
    getByShorthand: mock(async () => null),
    list: mock(async () => []),
    getTagOptionAssignments: mock(async () => []),
    assignTagOptions: mock(async () => {}),
  };

  const emitted: unknown[][] = [];
  const eventBus = { emit: (...args: unknown[]) => emitted.push(args) };
  const listByProject = mock(async () => [{ path: "/repo" }]);

  return {
    deps: {
      ticketsDb,
      eventBus,
      reposService: { listByProject },
    } as unknown as Parameters<typeof createTicketService>[0],
    ticketsDb,
    emitted,
  };
};

describe("TicketService", () => {
  describe("softDelete", () => {
    test("deletes, emits event, and fires post-delete automation", async () => {
      const { deps, ticketsDb, emitted } = buildDeps();
      const service = createTicketService(deps);

      const result = await service.softDelete("t1", "project_1");

      expect(result).toMatchObject({ id: "t1" });
      expect(ticketsDb.softDelete).toHaveBeenCalledWith("t1");
      expect(emitted).toContainEqual(["tickets", "set", expect.objectContaining({ id: "t1" })]);
    });

    test("returns null result when ticket not found", async () => {
      const { deps, ticketsDb } = buildDeps();
      (ticketsDb.softDelete as ReturnType<typeof mock>).mockImplementation(async () => null);
      const service = createTicketService(deps);

      const result = await service.softDelete("missing", "project_1");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    test("passes through to raw DB create", async () => {
      const { deps, ticketsDb } = buildDeps();
      const service = createTicketService(deps);

      const result = await service.create({ project_id: "project_1", title: "Test" } as never);

      expect(result).toMatchObject({ id: "ticket_1" });
      expect(ticketsDb.create).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    test("updates ticket and emits event", async () => {
      const { deps, ticketsDb, emitted } = buildDeps();
      const service = createTicketService(deps);

      const result = await service.update("t1", { status_id: "status_1" });

      expect(result).toMatchObject({ id: "t1" });
      expect(ticketsDb.update).toHaveBeenCalledWith("t1", { status_id: "status_1" });
      expect(emitted).toContainEqual(["tickets", "set", expect.objectContaining({ id: "t1" })]);
    });

    test("returns null when ticket not found", async () => {
      const { deps, ticketsDb, emitted } = buildDeps();
      (ticketsDb.update as ReturnType<typeof mock>).mockImplementation(async () => null);
      const service = createTicketService(deps);

      const result = await service.update("missing", {});

      expect(result).toBeNull();
      expect(emitted).toHaveLength(0);
    });
  });
});
