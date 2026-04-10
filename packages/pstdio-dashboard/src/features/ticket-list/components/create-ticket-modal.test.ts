import { describe, expect, it } from "bun:test";

describe("CreateTicketModal", () => {
  it("uses a close trigger that composes with the close button via asChild", async () => {
    const source = await Bun.file(new URL("./create-ticket-modal.tsx", import.meta.url)).text();

    expect(source).toContain("<Dialog.CloseTrigger asChild>");
  });

  it("syncs content with the project settings draft store while typing", async () => {
    const source = await Bun.file(new URL("./create-ticket-modal.tsx", import.meta.url)).text();

    expect(source).toContain("useProjectSettingsStore");
    expect(source).toContain("setCreateTicketDraft(value);");
  });

  it("clears the draft when the modal is closed", async () => {
    const source = await Bun.file(new URL("./create-ticket-modal.tsx", import.meta.url)).text();

    expect(source).toContain("const handleClose");
    expect(source).toContain("clearCreateTicketDraft();\n    resetForm();");
  });
});
