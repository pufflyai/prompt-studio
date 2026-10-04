import { afterAll, beforeAll, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { webviewOriginLabel } from "pstdio-extensions/webview-origin";
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
    const stdoutSpy = spyOn(process.stdout, "write").mockReturnValue(true);

    try {
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
    } finally {
      stdoutSpy.mockRestore();
    }
  });
});

describe("unsecured extension assets", () => {
  const webviewOrigin = `http://${webviewOriginLabel("missing")}.localhost:43123`;

  test("serves signed extension assets on their webview origin without runtime transport security", async () => {
    const basePath = handle.deps.extensionWebviewAccess
      .runtimeUrl({ installedExtensionId: "missing", webviewId: "missing" })
      .replace(/\/runtime$/, "");
    const res = await handle.app.request(`${webviewOrigin}${basePath}/runtime`, { headers: { origin: webviewOrigin } });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("keeps the API out of reach of webview origins even without runtime transport security", async () => {
    const res = await handle.app.request(`${webviewOrigin}/v1/projects`, { headers: { origin: webviewOrigin } });

    expect(res.status).toBe(404);
  });
});
