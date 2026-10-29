import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const withPackagedBoard = async (check: (page: Page) => Promise<void>) => {
  const startedAt = Date.now();
  const phase = (name: string) => console.log(`Packaged board: ${name} (${Date.now() - startedAt}ms)`);
  const root = mkdtempSync(join(tmpdir(), "packaged-board-panning-"));
  let child: ChildProcess | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const runtime = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-planner"),
    });
    child = runtime.child;
    phase("runtime ready");
    const folder = join(root, "project");
    mkdirSync(folder);
    const creatingProject = (async () => {
      const response = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Board panning" }, folder)),
      });
      expect(response.status).toBe(201);
      const { id } = (await response.json()) as { id: string };
      phase("project created");
      return id;
    })();
    const openingPage = chromium.launch(PACKAGED_DASHBOARD_BROWSER).then((opened) => {
      browser = opened;
      return opened.newPage({
        viewport: { width: 1000, height: 720 },
        extraHTTPHeaders: runtimeAuthorization(runtime.descriptor),
      });
    });
    const [projectSetup, browserSetup] = await Promise.allSettled([creatingProject, openingPage]);
    if (projectSetup.status === "rejected") throw projectSetup.reason;
    if (browserSetup.status === "rejected") throw browserSetup.reason;
    const id = projectSetup.value;
    const page = browserSetup.value;
    await Promise.all([
      createPlannerTicket(page.request, runtime.baseUrl, id, { content: "# Pan board ticket" }),
      createPlannerTicket(page.request, runtime.baseUrl, id, { content: "# Edge scroll ticket" }),
      createPlannerTicket(page.request, runtime.baseUrl, id, {
        content: "# Completed board ticket",
        statusId: "done",
      }),
    ]);
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    phase("tickets created");
    await signInBrowser(page, runtime.descriptor, `/projects/${id}/extensions/pstdio.pstdio-planner/tickets`);
    phase("browser signed in");
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    phase("board opened");
    await check(page);
    phase("behavior checked");
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
};
