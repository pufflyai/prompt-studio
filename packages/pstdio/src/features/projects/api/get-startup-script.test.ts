import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { getStartupScript } from "./get-startup-script";

describe("getStartupScript", () => {
  test("returns script content on 200", async () => {
    mockFetch(200, { startup_script: "bun install" });

    const result = await getStartupScript("http://test:3000", "proj-1");

    expect(result).toBe("bun install");
  });

  test("returns null when no script configured", async () => {
    mockFetch(200, { startup_script: null });

    const result = await getStartupScript("http://test:3000", "proj-1");

    expect(result).toBeNull();
  });

  test("throws on 404", async () => {
    mockFetch(404, { error: "Project not found" });

    expect(getStartupScript("http://test:3000", "unknown")).rejects.toThrow("Project not found: unknown");
  });

  test("throws on other errors", async () => {
    mockFetch(500, { error: "Internal" });

    expect(getStartupScript("http://test:3000", "proj-1")).rejects.toThrow("Failed to fetch startup script: 500");
  });
});
