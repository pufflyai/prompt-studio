import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { getProject } from "./get-project";

describe("getProject", () => {
  test("returns project when found", async () => {
    mockFetch(200, {
      id: "abc",
      name: "My Project",
      shorthand: "MP",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    const result = await getProject("http://test:3000", "abc");

    expect(result).toEqual({
      id: "abc",
      name: "My Project",
      shorthand: "MP",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
  });

  test("returns null when not found", async () => {
    mockFetch(404, { error: "Not found" });

    const result = await getProject("http://test:3000", "missing");

    expect(result).toBeNull();
  });
});
