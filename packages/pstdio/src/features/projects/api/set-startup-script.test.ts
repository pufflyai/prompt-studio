import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { setStartupScript } from "./set-startup-script";

describe("setStartupScript", () => {
  test("resolves on 204", async () => {
    mockFetch(204);

    await setStartupScript("http://test:3000", "proj-1", "bun install");
  });

  test("throws on 404", async () => {
    mockFetch(404, { error: "Project not found" });

    expect(setStartupScript("http://test:3000", "unknown", "bun install")).rejects.toThrow(
      "Project not found: unknown",
    );
  });

  test("throws on other errors", async () => {
    mockFetch(500, { error: "Internal" });

    expect(setStartupScript("http://test:3000", "proj-1", "bun install")).rejects.toThrow(
      "Failed to set startup script: 500",
    );
  });
});
