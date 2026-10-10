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
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { verifyTicketCreation } from "./packaged-ticket-creation";

export const registerBoardPanningSmokeTests = () => {
  test("packaged Planner board pans with a mouse and keeps ticket and column actions", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-board-panning-"));
    let child: ChildProcess | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      const runtime = await startPackagedServe(root, {
        PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-planner"),
      });
      child = runtime.child;
      const folder = join(root, "project");
      mkdirSync(folder);
      const response = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Board panning" }, folder)),
      });
      expect(response.status).toBe(201);
      const { id } = (await response.json()) as { id: string };
      browser = await chromium.launch();
      const page = await browser.newPage({
        viewport: { width: 1000, height: 720 },
        extraHTTPHeaders: runtimeAuthorization(runtime.descriptor),
      });
      await signInBrowser(page, runtime.descriptor);
      await createPlannerTicket(page.request, runtime.baseUrl, id, { content: "# Pan board ticket" });
      await createPlannerTicket(page.request, runtime.baseUrl, id, { content: "# Edge scroll ticket" });
      await createPlannerTicket(page.request, runtime.baseUrl, id, {
        content: "# Completed board ticket",
        statusId: "done",
      });
      await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
      await page.goto(`${runtime.baseUrl}/projects/${id}/`);
      await page.getByRole("option", { name: "Tickets", exact: true }).click();
      await verifyBoardPanning(page);
      await verifyBoardEdgeScrolling(page);
      const doneCard = page.getByTestId("renderer-card").filter({ hasText: "Completed board ticket" });
      await doneCard.scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "Column actions for Done", exact: true }).click();
      await page.getByRole("menuitem", { name: "Archive all", exact: true }).click();
      await expect(doneCard).toBeHidden();
      await page.getByTestId("board-column-backlog").scrollIntoViewIfNeeded();
      await verifyTicketCreation(page);
      await page.getByTestId("renderer-card").filter({ hasText: "Pan board ticket" }).click();
      await expect(page.getByTestId("board-column-backlog")).toBeHidden();
    } finally {
      await browser?.close();
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
