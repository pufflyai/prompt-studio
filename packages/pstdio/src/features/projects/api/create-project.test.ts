import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { createProject } from "./create-project";

describe("createProject", () => {
  test("returns created project on 201", async () => {
    mockFetch(201, { id: "new-id", name: "My Project" });

    const result = await createProject("http://test:3000", "My Project");

    expect(result).toEqual({ id: "new-id", name: "My Project" });
  });

  test("throws on non-ok response", async () => {
    mockFetch(500, { error: "Internal" });

    expect(createProject("http://test:3000", "fail")).rejects.toThrow("Failed to create project: 500");
  });
});
