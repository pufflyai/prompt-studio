import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { homePage } from "../helpers/home-loading";

interface DesktopQuitFixture {
  begin(): void;
  acknowledge(): void;
  choices: string[];
}

test("locks quit and keep-open controls until the desktop acknowledges the choice", async ({ page, request }) => {
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Quit feedback" }) });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    const host = window as unknown as { promptStudioDesktop: unknown; desktopQuitFixture: DesktopQuitFixture };
    const activity = { sessions: [], terminals: [{ id: "term", label: "Build terminal" }], jobs: [] };
    type State = { kind: string; activity?: typeof activity };
    let state: State = { kind: "workbench" };
    const listeners = new Set<(state: State) => void>();
    const publish = (next: State) => {
      state = next;
      for (const listener of listeners) listener(next);
    };
    const quit = Promise.withResolvers<void>();
    const choices: string[] = [];
    host.promptStudioDesktop = {
      getWorkbenchState: async () => ({ values: { "onboarding-complete": "true" } }),
      setWorkbenchItem: async () => {},
      getAppInfo: async () => ({ platform: "darwin", version: "0.0.0" }),
      getStartupState: async () => state,
      onStartupState: (listener: (state: State) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      cancelQuit: async () => {
        choices.push("keep-open");
      },
      confirmQuit: () => {
        choices.push("quit");
        return quit.promise;
      },
      setStartupAppearance: async () => {},
    };
    host.desktopQuitFixture = {
      begin: () => publish({ kind: "confirming_active_work", activity }),
      acknowledge() {
        publish({ kind: "closing" });
        quit.resolve();
      },
      choices,
    };
  });
  try {
    await page.goto(`/projects/${id}`);
    await expect(homePage(page)).toBeVisible();
    await page.evaluate(() =>
      (window as unknown as { desktopQuitFixture: DesktopQuitFixture }).desktopQuitFixture.begin(),
    );
    const dialog = page.getByRole("alertdialog", { name: "Active work is still running" });
    await expect(dialog.getByText("Build terminal")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel work and quit", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Quitting…" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Keep Prompt Studio open" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    const choices = await page.evaluate(() => {
      const fixture = (window as unknown as { desktopQuitFixture: DesktopQuitFixture }).desktopQuitFixture;
      fixture.acknowledge();
      return fixture.choices;
    });
    expect(choices).toEqual(["quit"]);
    await expect(dialog).toBeHidden();
  } finally {
    await request.delete(`/v1/projects/${id}`);
  }
});
