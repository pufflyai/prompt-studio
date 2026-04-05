import { describe, expect, it } from "bun:test";
import { findTicketByRef } from "./find-ticket-by-ref";

describe("findTicketByRef", () => {
  it("finds a ticket by shorthand or id", async () => {
    const tickets = [
      { id: "ticket-1", shorthand: "PS-1" },
      { id: "ticket-2", shorthand: "PS-2" },
    ];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => tickets,
        },
      },
    } as never;

    const byShorthand = await findTicketByRef(ctx, { ticketId: "PS-2" });
    const byId = await findTicketByRef(ctx, { ticketId: "ticket-1" });

    expect(byShorthand?.id).toBe("ticket-2");
    expect(byId?.shorthand).toBe("PS-1");
  });

  it("reuses the ticket object already present on hook context", async () => {
    const ticket = { id: "ticket-1", shorthand: "PS-1", status_name: "wip" } as unknown as NonNullable<
      Awaited<ReturnType<typeof findTicketByRef>>
    >;

    const ctx = {
      projectId: "proj-1",
      ticket,
      client: {
        tickets: {
          list: async () => {
            throw new Error("should not list tickets");
          },
        },
      },
    } as never;

    const resolved = await findTicketByRef(ctx, { ticketId: "PS-1" });

    expect(resolved === ticket).toBe(true);
  });
});
