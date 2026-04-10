import { describe, expect, it } from "bun:test";

describe("TicketsPanel", () => {
  it("rethrows create failures so the modal keeps its draft", async () => {
    const source = await Bun.file(new URL("./tickets-panel.tsx", import.meta.url)).text();

    expect(source).toContain('console.error("[create ticket]", error);');
    expect(source).toContain("throw error;");
  });

  it("keys the create modal by project to avoid stale drafts across project switches", async () => {
    const source = await Bun.file(new URL("./tickets-panel.tsx", import.meta.url)).text();

    expect(source).toContain('key={projectId ?? "global"}');
  });
});
