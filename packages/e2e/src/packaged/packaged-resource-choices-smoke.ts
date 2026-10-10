import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { writeResourceChoicesExtension } from "./resource-choices-fixture";

export const registerResourceChoicesSmokeTests = () => {
  test("packaged resource actions pass hidden values to dependent choices and submission", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-resource-choices-"));
    let child: ChildProcess | null = null;
    const browser = await chromium.launch({ headless: true });
    try {
      writeResourceChoicesExtension(root);
      const started = await startPackagedServe(root);
      child = started.child;
      const created = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Resource choices" }, root)),
      });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const page = await browser.newPage();
      await page.addInitScript((id) => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.setItem("dashboard-wb2:selected-project:global", id);
        localStorage.setItem(
          `pstdio-project-settings/projects/${id}/values`,
          JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
        );
      }, project.id);
      await signInBrowser(page, started.descriptor);
      await page.goto(`${started.baseUrl}/projects/${project.id}`);
      for (const id of ["first", "second"]) {
        await page.getByText(`Instance ${id}`, { exact: true }).first().click();
        await page.getByRole("button", { name: `Actions for Instance ${id}` }).click();
        await page.getByRole("menuitem", { name: "Choose instance template" }).click();
        const dialog = page.getByRole("dialog");
        expect(await dialog.getByText("Instance", { exact: true }).count()).toBe(0);
        await dialog.getByRole("button", { name: "Select template" }).click();
        await page.getByText(`Template for ${id}`, { exact: true }).click();
        const submission = page.waitForResponse(
          (response) =>
            response.url().includes("resource-choices.command.run") && response.request().method() === "POST",
        );
        await dialog.getByRole("button", { name: "Run", exact: true }).click();
        const response = await submission;
        expect(response.ok()).toBe(true);
        expect(response.request().postDataJSON().params).toEqual({ instance: id, template: `${id}-template` });
        expect(await response.json()).toMatchObject({
          outcome: { ok: true, value: { instance: id, template: `${id}-template` } },
        });
      }
    } finally {
      await browser.close();
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
