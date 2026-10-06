import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createTestApp } from "./test-utils/create-test-app";

setDefaultTimeout(10_000);

let handle: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  handle = await createTestApp({ host: { kind: "standalone" } });
});

afterAll(async () => {
  await handle?.close();
});

describe("api without a token", () => {
  test("serves loopback requests without wildcard CORS", async () => {
    const res = await handle.app.request("http://127.0.0.1:19841/v1/projects");

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("refuses a page from another site", async () => {
    const res = await handle.app.request("http://127.0.0.1:19841/v1/projects", {
      headers: { origin: "https://attacker.example" },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("refuses a CORS preflight from another site", async () => {
    const res = await handle.app.request("http://127.0.0.1:19841/v1/projects", {
      method: "OPTIONS",
      headers: {
        origin: "https://attacker.example",
        "access-control-request-method": "POST",
      },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("refuses a request whose host is not a loopback name", async () => {
    // A DNS rebinding page reaches 127.0.0.1 under its own host name and counts as same-origin.
    const res = await handle.app.request("http://attacker.example:19841/v1/projects", {
      headers: { origin: "http://attacker.example:19841" },
    });

    expect(res.status).toBe(403);
  });

  test("accepts the local development dashboard origin", async () => {
    const res = await handle.app.request("http://127.0.0.1:19841/v1/projects", {
      headers: { origin: "http://localhost:5173" },
    });

    expect(res.status).toBe(200);
  });

  test("keeps health checks public for any host", async () => {
    const res = await handle.app.request("http://container.internal:19841/healthz");

    expect(res.status).toBe(200);
  });
});
