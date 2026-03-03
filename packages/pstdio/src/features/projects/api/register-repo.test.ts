import { afterEach, describe, expect, mock, test } from "bun:test";
import { registerRepo } from "./register-repo";

const originalFetch = globalThis.fetch;

const mockFetch = (status: number, body: unknown) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  ) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("registerRepo", () => {
  test("returns repo on 201", async () => {
    mockFetch(201, { id: "repo-1", name: "my-repo", path: "/home/user/my-repo" });

    const result = await registerRepo("http://test:3000", "proj-1", {
      name: "my-repo",
      path: "/home/user/my-repo",
    });

    expect(result).toEqual({ id: "repo-1", name: "my-repo", path: "/home/user/my-repo" });
  });

  test("throws on non-ok response", async () => {
    mockFetch(500, { error: "Internal" });

    expect(registerRepo("http://test:3000", "proj-1", { name: "x", path: "/x" })).rejects.toThrow(
      "Failed to register repo: 500",
    );
  });
});
