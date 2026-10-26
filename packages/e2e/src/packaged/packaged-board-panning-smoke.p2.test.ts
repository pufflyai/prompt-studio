import { test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { verifyBoardEdgeScrolling } from "./packaged-board-edge-scrolling";
import { verifyBoardPanning } from "./packaged-board-panning";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { verifyTicketCreation } from "./packaged-ticket-creation";

setupPackagedSmokeTests();

test("packaged Planner board pans with a mouse and keeps ticket and column actions", async () => {
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
    const openingPage = chromium.launch(PROVISIONED_CHROMIUM).then((opened) => {
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
      createPlannerTicket(page.request, runtime.baseUrl, id, { content: "# Completed board ticket", statusId: "done" }),
    ]);
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    phase("tickets created");
    await signInBrowser(page, runtime.descriptor, `/projects/${id}/extensions/pstdio.pstdio-planner/tickets`);
    phase("browser signed in");
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    phase("board opened");
    await verifyBoardPanning(page);
    phase("panning checked");
    await verifyBoardEdgeScrolling(page);
    phase("edge scrolling checked");
    const doneCard = page.getByTestId("renderer-card").filter({ hasText: "Completed board ticket" });
    await doneCard.scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Column actions for Done", exact: true }).click();
    await page.getByRole("menuitem", { name: "Archive all", exact: true }).click();
    await expect(doneCard).toBeHidden();
    await page.getByTestId("board-column-backlog").scrollIntoViewIfNeeded();
    await verifyTicketCreation(page);
    phase("ticket creation checked");
    await page.getByTestId("renderer-card").filter({ hasText: "Pan board ticket" }).click();
    await expect(page.getByTestId("board-column-backlog")).toBeHidden();
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
