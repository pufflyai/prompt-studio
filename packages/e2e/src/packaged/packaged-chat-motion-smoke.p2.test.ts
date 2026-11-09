// Includes replay chunks, cached history, file navigation through reload and Back, and panel motion.
import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { logTestPhase } from "../scripts/log-test-phase";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import {
  createPackagedStreamingSession,
  expectPackagedPanelMotion,
  expectPackagedStreamingMotion,
} from "./packaged-motion-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

for (const kind of ["streaming", "panels"] as const) {
  test(
    kind === "streaming"
      ? "retains streaming messages and cached history"
      : "animates panels and restores their resized dimensions after reopening",
    async () => {
      const startedAt = Date.now();
      const phase = (name: string) => logTestPhase(`Packaged chat motion: ${name} (${Date.now() - startedAt}ms)`);
      const root = mkdtempSync(join(tmpdir(), "pstdio-packaged-chat-motion-"));
      let child: ChildProcess | undefined;
      let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
      let page: Page | undefined;
      try {
        const startingRuntime = startPackagedServe(root, {
          PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture", "pstdio-session-browser"),
        }).then((runtime) => {
          child = runtime.child;
          return runtime;
        });
        const openingPage = chromium.launch(PACKAGED_DASHBOARD_BROWSER).then((opened) => {
          browser = opened;
          return opened.newPage();
        });
        const creatingProject = startingRuntime.then(async (started) => {
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
          const [idleResponse, replaySessionId] = await Promise.all([
            fetch(`${started.baseUrl}/v1/sessions`, {
              method: "POST",
              headers: { ...headers, "content-type": "application/json" },
              body: JSON.stringify({
                project_id: project.id,
                title: "Idle connection",
                prompt: "First idle-session message",
                agent: "pstdio.workbench-fixture.harness.fake",
              }),
            }),
            kind === "streaming"
              ? createPackagedStreamingSession(started.baseUrl, project.id, headers)
              : Promise.resolve(""),
          ]);
          expect(idleResponse.ok).toBe(true);
          phase("second conversation created");
          return { started, headers, folder, project, replaySessionId };
        });
        const [projectSetup, browserSetup] = await Promise.allSettled([creatingProject, openingPage]);
        if (projectSetup.status === "rejected") throw projectSetup.reason;
        if (browserSetup.status === "rejected") throw browserSetup.reason;
        const { started, headers, folder, project, replaySessionId } = projectSetup.value;
        page = browserSetup.value;
        await page.setExtraHTTPHeaders(headers);
        await page.addInitScript((projectId) => {
          localStorage.setItem("onboarding-complete", "true");
          localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
        }, project.id);
        await page.goto(`${started.baseUrl}/projects/${project.id}/sessions`);
        phase("dashboard opened");
        await page.getByRole("option", { name: "Idle connection", exact: true }).click();
        if (kind === "streaming") {
          await expectPackagedStreamingMotion(page, started.baseUrl, headers, folder, replaySessionId);
          phase("streaming and retained history checked");
        } else {
          await expectPackagedPanelMotion(page);
          phase("panel motion checked");
        }
      } catch (error) {
        console.error("Packaged chat motion failed", error);
        if (page && !page.isClosed()) {
          const failedPage = page;
          let captureOpen = true;
          let captureDeadline: ReturnType<typeof setTimeout> | undefined;
          const capture = async () => {
            const snapshot = await failedPage.evaluate(() => ({
              url: location.href,
              viewports: Array.from(document.querySelectorAll('[role="log"] [data-part="viewport"]')).map(
                (element) => ({
                  top: element.scrollTop,
                  height: element.clientHeight,
                  contentHeight: element.scrollHeight,
                  rows: Array.from(element.querySelectorAll("[data-chat-message-list-item]")).map((row) => ({
                    index: row.getAttribute("data-index"),
                    text: row.textContent?.slice(0, 100),
                    top: row.getBoundingClientRect().top,
                    height: row.getBoundingClientRect().height,
                  })),
                }),
              ),
              text: document.body.innerText,
            }));
            if (!captureOpen) return;
            const evidence = join(import.meta.dirname, "../../test-results/packaged-chat-motion");
            mkdirSync(evidence, { recursive: true });
            const prefix = join(evidence, basename(root));
            writeFileSync(`${prefix}.json`, JSON.stringify(snapshot, null, 2));
            await failedPage.screenshot({ path: `${prefix}.png`, timeout: 1_000 });
          };
          try {
            await Promise.race([
              capture().catch((captureError) =>
                console.error("Could not capture chat failure diagnostics", captureError),
              ),
              new Promise<void>((resolve) => {
                captureDeadline = setTimeout(resolve, 1_000);
              }),
            ]);
          } finally {
            captureOpen = false;
            clearTimeout(captureDeadline);
          }
        }
        throw error;
      } finally {
        await browser?.close();
        if (child) await stopProcess(child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
}
