import { afterEach, describe, expect, mock, test } from "bun:test";
import { setStartupScript } from "./set-startup-script";

const originalFetch = globalThis.fetch;

const mockFetch = (status: number, body?: unknown) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(body ? JSON.stringify(body) : null, { status })),
  ) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

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
