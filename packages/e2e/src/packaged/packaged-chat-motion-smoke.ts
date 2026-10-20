import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { logTestPhase } from "../scripts/log-test-phase";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { expectPackagedPanelMotion, expectPackagedStreamingMotion } from "./packaged-motion-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerPackagedChatMotionSmokeTests = () => {
  test(
    "retains streaming messages and cached history while panels animate and resize",
    async () => {
      const startedAt = Date.now();
      const phase = (name: string) => logTestPhase(`Packaged chat motion: ${name} (${Date.now() - startedAt}ms)`);
      const root = mkdtempSync(join(tmpdir(), "pstdio-packaged-chat-motion-"));
      let child: ChildProcess | undefined;
      const browser = await chromium.launch(PROVISIONED_CHROMIUM);
      try {
        const started = await startPackagedServe(root, {
          PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture"),
        });
        child = started.child;
        phase("runtime ready");
        const headers = runtimeAuthorization(started.descriptor);
        const folder = join(root, "chat-project");
        mkdirSync(folder);
        const projectResponse = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify(
            folderProjectInput({ name: "Chat motion", agents: ["pstdio.workbench-fixture.harness.fake"] }, folder),
          ),
        });
        expect(projectResponse.ok).toBe(true);
        const project = (await projectResponse.json()) as { id: string };
        phase("project created");
        // A second conversation lets history checks switch away and reopen the retained replay.
        const idleResponse = await fetch(`${started.baseUrl}/v1/sessions`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({
            project_id: project.id,
            title: "Idle connection",
            prompt: "First idle-session message",
            agent: "pstdio.workbench-fixture.harness.fake",
          }),
        });
        expect(idleResponse.ok).toBe(true);
        phase("second conversation created");
        const page = await browser.newPage({ extraHTTPHeaders: headers });
        await page.addInitScript((projectId) => {
          localStorage.setItem("onboarding-complete", "true");
          localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
        }, project.id);
        await page.goto(`${started.baseUrl}/projects/${project.id}/sessions`);
        phase("dashboard opened");
        await expectPackagedStreamingMotion(page, started.baseUrl, project.id, headers, folder);
        phase("streaming and retained history checked");
        await expectPackagedPanelMotion(page);
        phase("panel motion checked");
      } finally {
        await browser.close();
        if (child) await stopProcess(child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
