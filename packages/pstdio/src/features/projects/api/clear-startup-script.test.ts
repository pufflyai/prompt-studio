import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { clearStartupScript } from "./clear-startup-script";

describe("clearStartupScript", () => {
  test("resolves on 204", async () => {
    mockFetch(204);

    await clearStartupScript("http://test:3000", "proj-1");
  });

  test("throws on 404", async () => {
    mockFetch(404, { error: "Project not found" });

    expect(clearStartupScript("http://test:3000", "unknown")).rejects.toThrow("Project not found: unknown");
  });

  test("throws on other errors", async () => {
    mockFetch(500, { error: "Internal" });

    expect(clearStartupScript("http://test:3000", "proj-1")).rejects.toThrow("Failed to clear startup script: 500");
  });
});
