import { afterAll, beforeAll, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { createTestApp } from "./test-utils/create-test-app";

setDefaultTimeout(10_000);

let handle: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  handle = await createTestApp();
});

afterAll(async () => {
  await handle?.close();
});

describe("onError handler", () => {
  test("returns 500 with the error message and stable code for unhandled errors", async () => {
    const stderrSpy = spyOn(process.stderr, "write").mockReturnValue(true);
    const stdoutSpy = spyOn(process.stdout, "write").mockReturnValue(true);

    // Request a non-existent route that triggers an internal path causing an error
    // We use an endpoint that will throw when the underlying service fails
    // Closing the DB and making a request will cause an unhandled service error
    // Instead, we test by adding a throwing middleware for this test
    handle.app.get("/test-error", () => {
      throw new Error("test unhandled error");
    });

    const res = await handle.app.request("/test-error");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: "internal_server_error", error: "test unhandled error" });

    // Verify structured JSON was written to stdout via shared logger.
    const stdoutCalls = stdoutSpy.mock.calls;
    const errorLog = stdoutCalls.find((call) => {
      try {
        const parsed = JSON.parse(call[0] as string);
        return parsed.event === "api.request.error" && parsed.message === "test unhandled error";
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

    // Legacy per-error stderr JSON persistence was removed.
    const stderrCalls = stderrSpy.mock.calls;
    const hasStructuredStderrError = stderrCalls.some((call) => {
      try {
        const parsed = JSON.parse(call[0] as string);
        return parsed.message === "test unhandled error";
      } catch {
        return false;
      }
    });
    expect(hasStructuredStderrError).toBe(false);

    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });
});

describe("unsecured extension assets", () => {
  test("allows signed opaque-origin extension assets without runtime transport security", async () => {
    const basePath = handle.deps.extensionWebviewAccess
      .runtimeUrl({ installName: "missing", webviewId: "missing" })
      .replace(/\/runtime$/, "");
    const res = await handle.app.request(`http://127.0.0.1:43123${basePath}/runtime`, {
      headers: { origin: "null" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("null");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(res.headers.get("vary")).toContain("Origin");
  });
});
