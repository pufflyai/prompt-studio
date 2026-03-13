import { describe, expect, test } from "bun:test";
import { buildImplementTicketPrompt } from "./build-prompts";

describe("buildImplementTicketPrompt", () => {
  test("builds the default implement-ticket prompt for a shorthand", () => {
    expect(buildImplementTicketPrompt("PS-25")).toBe("Implement ticket: PS-25");
  });
});
