import { afterEach, describe, expect, test } from "bun:test";
import { e2eExtensions } from "../default-extensions";
import { createProjectViaApi } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { FLOW_TIMEOUT } from "./timeouts";

describe("non-blocking startup tasks", () => {
  let api: ApiInstance | null = null;

  afterEach(async () => {
    if (api) {
      await api.stop();
      api = null;
    }
  });

  test(
    "server accepts requests immediately after start",
    async () => {
      api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture") } });

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
      api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture") } });

      // Create a session so startup tasks have work if server restarts
      const project = await createProjectViaApi(api.url, "shutdown-test");
      const sessionRes = await fetch(`${api.url}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "test session",
          prompt: "hello",
          agent: "pstdio.workbench-fixture.harness.fake",
        }),
      });
      expect(sessionRes.ok).toBe(true);

      // The raw API test process still shuts down cleanly when its owner exits.
      await api.stop();
      await expect(fetch(`${api.url}/healthz`)).rejects.toThrow();
      api = null;
    },
    FLOW_TIMEOUT,
  );
});
