import { describe, expect, it } from "bun:test";

describe("CreateTicketModal", () => {
  it("uses a close trigger that composes with the close button via asChild", async () => {
    const source = await Bun.file(new URL("./create-ticket-modal.tsx", import.meta.url)).text();

    expect(source).toContain("<Dialog.CloseTrigger asChild>");
  });
});
