import { describe, expect, it } from "bun:test";
import { renderPrompt } from "./render-prompt";

describe("renderPrompt", () => {
  it("renders a prompt template with vars", () => {
    const prompt = renderPrompt("Refine ticket: {{ticket}}", { ticket: "PS-42" });
    expect(prompt).toBe("Refine ticket: PS-42");
  });

  it("renders truthy sections in prompt templates", () => {
    const prompt = renderPrompt(
      "Breakdown ticket: {{ticket}}\n{{#templateName}}Use template: {{templateName}}{{/templateName}}",
      { ticket: "PS-7", templateName: "ticket-template" },
    );

    expect(prompt).toContain("Breakdown ticket: PS-7");
    expect(prompt).toContain("Use template: ticket-template");
  });
});
