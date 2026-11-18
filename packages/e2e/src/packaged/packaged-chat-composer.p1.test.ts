import { afterEach, expect, test } from "bun:test";
import { e2eExtensions } from "../default-extensions";
import { createComposerFixture } from "./packaged-chat-composer-fixture";
import { expectPackagedChatComposer } from "./packaged-chat-composer-smoke";
import { expectPackagedDriveDiscovery } from "./packaged-filesystem-smoke";
import { runtimeAuthorization } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();
const composerDefaults = e2eExtensions("workbench-fixture", "pstdio-session-browser", "pstdio-workspaces");

let fixture: ReturnType<typeof createComposerFixture> | undefined;
afterEach(async () => {
  await fixture?.cancel();
  fixture = undefined;
});

// PS-185: retain the complete cold composer workload and its original Windows45s allowance.
test(
  "serves the dashboard and API, hands off composer drafts, and starts idle sessions on their first message",
  async () => {
    const began = performance.now();
    const allowance = Math.max(PACKAGED_TEST_TIMEOUT, 45_000);
    const owned = createComposerFixture(allowance, began);
    fixture = owned;

    try {
      // The browser process and packaged host are independent until dashboard navigation.
      const [started, browser] = await Promise.all([
        owned.start({ PSTDIO_DEFAULT_EXTENSIONS: composerDefaults }),
        owned.launchBrowser(),
      ]);

      const dashboardRes = await fetch(started.baseUrl, { signal: owned.signal });
      expect(dashboardRes.status).toBe(200);
      expect(dashboardRes.headers.get("content-type")).toContain("text/html");
      const dashboardHtml = await dashboardRes.text();
      const moduleScript = dashboardHtml.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
      expect(moduleScript).not.toBeNull();
      const dashboardScript = await fetch(new URL(moduleScript![1]!, started.baseUrl), { signal: owned.signal });
      expect(dashboardScript.status).toBe(200);
      expect(dashboardScript.headers.get("content-type")).toMatch(/javascript/);

      const projectsRes = await fetch(`${started.baseUrl}/v1/projects`, {
        headers: runtimeAuthorization(started.descriptor),
        signal: owned.signal,
      });
      expect(projectsRes.status).toBe(200);
      expect(await projectsRes.json()).toEqual([]);
      await expectPackagedDriveDiscovery(started.baseUrl, runtimeAuthorization(started.descriptor), owned.signal);
      const renameRes = await fetch(`${started.baseUrl}/v1/sessions/missing/title`, {
        method: "PATCH",
        signal: owned.signal,
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify({ title: " " }),
      });
      expect(renameRes.status).toBe(400);
      await expectPackagedChatComposer(started.baseUrl, runtimeAuthorization(started.descriptor), owned, browser);
    } catch (error) {
      try {
        await owned.cancel();
      } catch (cleanupError) {
        if (cleanupError !== error) throw new AggregateError([error, cleanupError], "Composer case and cleanup failed");
      } finally {
        fixture = undefined;
      }
      throw error;
    }
    await owned.close();
    // Bun's PASS label must never certify a whole-case overrun hidden by cleanup.
    expect(performance.now() - began).toBeLessThanOrEqual(allowance);
  },
  Math.max(PACKAGED_TEST_TIMEOUT, 45_000),
);
