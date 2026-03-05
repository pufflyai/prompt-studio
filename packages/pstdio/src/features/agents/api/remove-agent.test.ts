import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { removeAgent } from "./remove-agent";

describe("removeAgent", () => {
  test("resolves on 204", async () => {
    mockFetch(204);

    await removeAgent("http://test:3000", "claude-code");
  });

  test("throws on 404", async () => {
    mockFetch(404, { error: "Agent not found" });

    expect(removeAgent("http://test:3000", "unknown")).rejects.toThrow("Agent not found: unknown");
  });

  test("throws on other errors", async () => {
    mockFetch(500, { error: "Internal" });

    expect(removeAgent("http://test:3000", "claude-code")).rejects.toThrow("Failed to remove agent: 500");
  });
});
