import { afterEach, describe, expect, test } from "bun:test";
import { e2eExtensions } from "../default-extensions";
import { createProjectViaApi } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { FLOW_TIMEOUT } from "./timeouts";

describe("non-blocking startup tasks", () => {
  let api: ApiInstance | null = null;

  afterEach(async () => {
    if (api) {
      api.stop();
      api = null;
    }
  });

  test(
    "server accepts requests immediately after start",
    async () => {
      api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("extension-lab") } });

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
      api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("extension-lab") } });

      // Create a session so startup tasks have work if server restarts
      const project = await createProjectViaApi(api.url, "shutdown-test");
      const sessionRes = await fetch(`${api.url}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "test session",
          prompt: "hello",
          agent: "pstdio.extension-lab.harness.fake",
        }),
      });
      expect(sessionRes.ok).toBe(true);

      // The raw API test process still shuts down cleanly when its owner exits.
      api.stop();

      // Verify the server is actually down
      await new Promise((r) => setTimeout(r, 500));
      try {
        await fetch(`${api.url}/healthz`);
        expect(false).toBe(true); // should not reach here
      } catch {
        // expected: connection refused
      }
      api = null;
    },
    FLOW_TIMEOUT,
  );
});
