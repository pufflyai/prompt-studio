import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { fakeHarnessId } from "../helpers/session-side-panel";
import { uiOrigin as apiBase } from "../ui-server";

for (const destination of ["Main", "Side", "Secondary"]) {
  test(`closing the session tab in ${destination} returns to the shared new-session page`, async ({
    page,
    request,
  }) => {
    const project = await (
      await request.post(`${apiBase}/v1/projects`, {
        data: folderProjectInput({ name: `Close session in ${destination}` }),
      })
    ).json();
    const session = await (
      await request.post(`${apiBase}/v1/sessions`, {
        data: { project_id: project.id, title: "Session X", prompt: "Working __fake_hold__", agent: fakeHarnessId },
      })
    ).json();
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, project.id);
    try {
      const root = `/projects/${project.id}/sessions`;
      await page.goto(root);
      const editor = page.locator('[data-testid="content-editable"][contenteditable="true"]:visible');
      await editor.fill("Keep my new-session draft");
      await editor.evaluate((element) => {
        (window as Window & { newSessionEditor?: Element }).newSessionEditor = element;
      });
      await page.getByRole("option", { name: session.title, exact: true }).click();
      const tab = page.getByRole("tab", { name: session.title, exact: true });
      await expect(tab).toBeVisible();
      if (destination !== "Main") {
        await tab.focus();
        await tab.press("Shift+F10");
        await page.getByRole("menuitem", { name: `Move to ${destination}`, exact: true }).click();
      }
      const region = destination === "Secondary" ? "secondary" : destination.toLowerCase();
      await expect(
        page.locator(`[data-workbench-panel="${region}"]`).getByRole("tab", { name: session.title, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: `Close ${session.title}`, exact: true }).click();
      await expect(page).toHaveURL(root);
      await expect(editor).toHaveText("Keep my new-session draft");
      expect(
        await editor.evaluate(
          (element) => element === (window as Window & { newSessionEditor?: Element }).newSessionEditor,
        ),
      ).toBe(true);
      const saved = await request.get(`${apiBase}/v1/sessions/${session.id}`);
      expect(saved.ok()).toBe(true);
      expect((await saved.json()).status).toBe("in_progress");
      await page.getByRole("button", { name: "Page actions", exact: true }).click();
      await page.getByRole("menuitem", { name: "New session", exact: true }).click();
      await expect(page).toHaveURL(root);
      await expect(editor).toHaveText("Keep my new-session draft");
      await page.reload();
      await expect(editor).toHaveText("Keep my new-session draft");
      await page.getByRole("button", { name: "Close New session", exact: true }).click();
      await expect(page).toHaveURL(root);
      await expect(editor).toHaveCount(0);
      await page.keyboard.press("ControlOrMeta+Alt+s");
      await expect(page).toHaveURL(root);
      await expect(editor).toHaveText("Keep my new-session draft");
      await page.getByRole("button", { name: "Close New session", exact: true }).click();
      await page.getByRole("option", { name: session.title, exact: true }).click();
      await page.getByRole("button", { name: `Close ${session.title}`, exact: true }).click();
      await expect(page).toHaveURL(root);
      await expect(editor).toHaveText("Keep my new-session draft");
    } finally {
      await request.patch(`${apiBase}/v1/sessions/${session.id}/status`, { data: { status: "cancelled" } });
    }
  });
}
