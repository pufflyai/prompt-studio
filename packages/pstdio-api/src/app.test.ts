import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "./app";
import type { AppBindings } from "./types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-app-test-"));
  app = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("onError handler", () => {
  test("returns 500 with generic message for unhandled errors", async () => {
    const stderrSpy = spyOn(process.stderr, "write").mockReturnValue(true);

    // Request a non-existent route that triggers an internal path causing an error
    // We use an endpoint that will throw when the underlying service fails
    // Closing the DB and making a request will cause an unhandled service error
    // Instead, we test by adding a throwing middleware for this test
    app.get("/test-error", () => {
      throw new Error("test unhandled error");
    });

    const res = await app.request("/test-error");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });

    // Verify structured JSON was written to stderr
    const calls = stderrSpy.mock.calls;
    const errorLog = calls.find((call) => {
      try {
        const parsed = JSON.parse(call[0] as string);
        return parsed.message === "test unhandled error";
      } catch {
        return false;
      }
    });
    expect(errorLog).toBeDefined();

    const parsed = JSON.parse(errorLog![0] as string);
    expect(parsed.level).toBe("error");
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/test-error");
    expect(parsed.status).toBe(500);

    stderrSpy.mockRestore();
  });
});
