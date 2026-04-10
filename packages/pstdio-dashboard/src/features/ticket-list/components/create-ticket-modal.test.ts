import { describe, expect, it } from "bun:test";

describe("CreateTicketModal", () => {
  it("uses a close trigger that composes with the close button via asChild", async () => {
    const source = await Bun.file(new URL("./create-ticket-modal.tsx", import.meta.url)).text();

    expect(source).toContain("<Dialog.CloseTrigger asChild>");
  });

  it("reads and writes its content through the project settings draft store", async () => {
    const source = await Bun.file(new URL("./create-ticket-modal.tsx", import.meta.url)).text();

    expect(source).toContain("useProjectSettingsStore");
    expect(source).toContain("const [content, setContent] = useState(createTicketDraft);");
    expect(source).toContain("setCreateTicketDraft(value);");
    expect(source).toContain("clearCreateTicketDraft();");
    expect(source).not.toContain("handleCancel");
  });
});
