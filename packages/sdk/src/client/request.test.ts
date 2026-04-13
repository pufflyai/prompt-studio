import { describe, expect, it } from "bun:test";
import { createRequest, PstdioApiError } from "./request";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const mockFetchFn = (fn: (...args: unknown[]) => Promise<Response>) => fn as unknown as typeof fetch;

describe("createRequest", () => {
  it("makes a GET request to the base URL + path", async () => {
    const calls: unknown[][] = [];
    const request = createRequest({
      baseUrl: "http://test:1234",
      fetch: mockFetchFn((...args) => {
        calls.push(args);
        return Promise.resolve(jsonResponse({ id: "1" }));
      }),
    });

    const result = await request<{ id: string }>("/v1/projects");

    expect(result).toEqual({ id: "1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe("http://test:1234/v1/projects");
  });

  it("sends JSON body for POST requests", async () => {
    const calls: unknown[][] = [];
    const request = createRequest({
      baseUrl: "http://test:1234",
      fetch: mockFetchFn((...args) => {
        calls.push(args);
        return Promise.resolve(jsonResponse({ ok: true }));
      }),
    });

    await request("/v1/projects", { method: "POST", body: { name: "test" } });

    const init = calls[0]![1] as RequestInit;
    expect(init.body).toBe('{"name":"test"}');
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("sends authorization header when token is provided", async () => {
    const calls: unknown[][] = [];
    const request = createRequest({
      baseUrl: "http://test:1234",
      token: "secret",
      fetch: mockFetchFn((...args) => {
        calls.push(args);
        return Promise.resolve(jsonResponse({}));
      }),
    });

    await request("/v1/projects");

    const init = calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
  });

  it("throws PstdioApiError with message from error body", async () => {
    const request = createRequest({
      baseUrl: "http://test:1234",
      fetch: mockFetchFn(() => Promise.resolve(jsonResponse({ error: "Not found" }, 404))),
    });

    try {
      await request("/v1/projects/bad");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PstdioApiError);
      expect((err as PstdioApiError).message).toBe("Not found");
      expect((err as PstdioApiError).status).toBe(404);
    }
  });

  it("throws PstdioApiError with generic message when body has no error field", async () => {
    const request = createRequest({
      baseUrl: "http://test:1234",
      fetch: mockFetchFn(() => Promise.resolve(new Response("bad", { status: 500 }))),
    });

    try {
      await request("/v1/boom");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PstdioApiError);
      expect((err as PstdioApiError).message).toBe("Request failed: 500");
    }
  });

  it("includes hook output in the error message when present", async () => {
    const request = createRequest({
      baseUrl: "http://test:1234",
      fetch: mockFetchFn(() =>
        Promise.resolve(
          jsonResponse(
            {
              error: "Pre-hook rejected the transition",
              hook_output: "You should add your poems to the ./files folder",
            },
            422,
          ),
        ),
      ),
    });

    try {
      await request("/v1/workspaces/ws-1/attempt-status", { method: "PATCH", body: { status: "review-ready" } });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PstdioApiError);
      expect((err as PstdioApiError).message).toBe(
        "Pre-hook rejected the transition\nYou should add your poems to the ./files folder",
      );
      expect((err as PstdioApiError).status).toBe(422);
    }
  });

  it("formats zod validation errors instead of stringifying the object", async () => {
    const request = createRequest({
      baseUrl: "http://test:1234",
      fetch: mockFetchFn(() =>
        Promise.resolve(
          jsonResponse(
            {
              success: false,
              error: {
                name: "ZodError",
                issues: [
                  { code: "invalid_type", path: ["body", "display_title"], message: "Expected string, received null" },
                  { code: "unrecognized_keys", path: [], message: "Unrecognized key: 'foo'" },
                ],
              },
            },
            400,
          ),
        ),
      ),
    });

    try {
      await request("/v1/tickets/bad", { method: "PATCH", body: {} });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PstdioApiError);
      const message = (err as PstdioApiError).message;
      expect(message).not.toContain("[object Object]");
      expect(message).toContain("Expected string, received null");
      expect(message).toContain("body.display_title");
    }
  });

  it("falls back to JSON when the error field is a non-zod object", async () => {
    const request = createRequest({
      baseUrl: "http://test:1234",
      fetch: mockFetchFn(() => Promise.resolve(jsonResponse({ error: { code: "EBUSY", detail: "locked" } }, 409))),
    });

    try {
      await request("/v1/whatever");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as PstdioApiError).message).not.toContain("[object Object]");
      expect((err as PstdioApiError).message).toContain("EBUSY");
    }
  });

  it("returns undefined for 204 responses", async () => {
    const request = createRequest({
      baseUrl: "http://test:1234",
      fetch: mockFetchFn(() => Promise.resolve(new Response(null, { status: 204 }))),
    });

    const result = await request("/v1/projects/1", { method: "DELETE" });
    expect(result).toBeUndefined();
  });
});
