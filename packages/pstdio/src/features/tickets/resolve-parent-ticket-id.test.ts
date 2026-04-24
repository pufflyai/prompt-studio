import { describe, expect, mock, test } from "bun:test";
import { createResolveParentTicketId } from "./resolve-parent-ticket-id";

describe("resolveParentTicketId", () => {
  test("resolves shorthand to ticket id", async () => {
    const resolveParentTicketId = createResolveParentTicketId({
      resolveTicketByShorthand: mock(async () => ({ id: "ticket-uuid-1" }) as never),
      getTicket: mock(async () => null),
    });

    await expect(resolveParentTicketId("proj-1", "PS-12")).resolves.toBe("ticket-uuid-1");
  });

  test("resolves raw UUID when ticket exists", async () => {
    const ticketId = "11111111-1111-4111-8111-111111111111";
    const resolveParentTicketId = createResolveParentTicketId({
      resolveTicketByShorthand: mock(async () => null as never),
      getTicket: mock(async () => ({ id: ticketId }) as never),
    });

    await expect(resolveParentTicketId("proj-1", ticketId)).resolves.toBe(ticketId);
  });

  test("throws when parent ticket is not found", async () => {
    const resolveParentTicketId = createResolveParentTicketId({
      resolveTicketByShorthand: mock(async () => null as never),
      getTicket: mock(async () => null),
    });

    await expect(resolveParentTicketId("proj-1", "PS-999")).rejects.toThrow("Parent ticket not found: PS-999");
  });
});
