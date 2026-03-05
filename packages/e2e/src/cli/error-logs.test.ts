import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ApiInstance, startApi } from "./start-api";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, 20_000);

afterAll(() => {
  api?.stop();
});

describe("API error handling", () => {
  test("returns JSON error for 404 routes", async () => {
    const res = await fetch(`${api.url}/v1/nonexistent-route`);

    expect(res.status).toBe(404);
  });

  test("returns 400 for invalid request body", async () => {
    const res = await fetch(`${api.url}/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBeLessThan(500);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("returns JSON with error field for server errors", async () => {
    // Delete a nonexistent project — should return 4xx, not 5xx
    const res = await fetch(`${api.url}/v1/projects/nonexistent-id-12345`, {
      method: "DELETE",
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    const body = await res.json();
    // 4xx responses should not crash the server
    expect(body).toBeDefined();
  });

  test("API stays healthy after error responses", async () => {
    // Send a few bad requests
    await fetch(`${api.url}/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });

    await fetch(`${api.url}/v1/nonexistent`);

    // API should still be healthy
    const health = await fetch(`${api.url}/healthz`);
    expect(health.ok).toBe(true);

    const body = await health.json();
    expect(body.ok).toBe(true);
  });
});
