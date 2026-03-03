import { afterEach, describe, expect, mock, test } from "bun:test";
import { deleteProject } from "./delete-project";

const originalFetch = globalThis.fetch;

const mockFetch = (status: number, body?: unknown) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(body ? JSON.stringify(body) : null, { status })),
  ) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("deleteProject", () => {
  test("resolves on 204", async () => {
    mockFetch(204);

    await deleteProject("http://test:3000", "proj-1");
  });

  test("throws on 404", async () => {
    mockFetch(404, { error: "Project not found" });

    expect(deleteProject("http://test:3000", "unknown")).rejects.toThrow("Project not found: unknown");
  });

  test("throws on other errors", async () => {
    mockFetch(500, { error: "Internal" });

    expect(deleteProject("http://test:3000", "proj-1")).rejects.toThrow("Failed to delete project: 500");
  });
});
