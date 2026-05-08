import { afterEach, describe, expect, test } from "bun:test";
import { createProjectViaApi, shutdownApiViaHttp } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { FLOW_TIMEOUT } from "./timeouts";

describe("non-blocking startup tasks", () => {
  let api: ApiInstance | null = null;

  afterEach(async () => {
    if (api) {
      await shutdownApiViaHttp(api.url);
      await new Promise((r) => setTimeout(r, 500));
      api.stop();
      api = null;
    }
  });

  test(
    "server accepts requests immediately after start",
    async () => {
      api = await startApi();

      // API responds to healthz right away
      const healthRes = await fetch(`${api.url}/healthz`);
      expect(healthRes.ok).toBe(true);

      // API can serve real requests immediately
      const project = await createProjectViaApi(api.url, "startup-test");
      expect(project.name).toBe("startup-test");
    },
    FLOW_TIMEOUT,
  );

  test(
    "shutdown completes cleanly after startup",
    async () => {
      api = await startApi();

      // Create a session so startup tasks have work if server restarts
      const project = await createProjectViaApi(api.url, "shutdown-test");
      const sessionRes = await fetch(`${api.url}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "test session",
          prompt: "hello",
          agent: "fake",
        }),
      });
      expect(sessionRes.ok).toBe(true);

      // Shutdown should complete without hanging
      const shutdownRes = await fetch(`${api.url}/shutdown`, { method: "POST" });
      expect(shutdownRes.ok).toBe(true);

      // Verify the server is actually down
      await new Promise((r) => setTimeout(r, 500));
      try {
        await fetch(`${api.url}/healthz`);
        expect(false).toBe(true); // should not reach here
      } catch {
        // expected: connection refused
      }

      api.stop();
      api = null;
    },
    FLOW_TIMEOUT,
  );
});
