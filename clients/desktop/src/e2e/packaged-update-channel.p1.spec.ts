import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  runPackagedCli,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

const openUpdateChannel = async (page: Page) => {
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog").filter({ hasText: "Developer tools" });
  await settings.getByText("Update channel", { exact: true }).click();
  return settings;
};

const readChannelFile = (home: string) =>
  JSON.parse(readFileSync(join(home, "desktop", "update-channel.json"), "utf8")) as { channel: string };

// A switch in Settings starts an update check against the public feed. Switching to
// nightly there could download a real nightly over the app under test, so the agent
// moves to nightly and the person moves back to stable.
// Update settings belong to the host; neither case needs default harness downloads.
test("a person and an agent switch the same update channel", async () => {
  test.skip(process.platform === "win32", "Windows follows the stable channel only");
  let app: PackagedApp | null = null;
  try {
    const home = createPackagedHome();
    app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    const project = await createPackagedProject(app, "Update channel");
    await openPackagedProject(app.page, project);

    const settings = await openUpdateChannel(app.page);
    await expect(settings.getByRole("button", { name: /Stable/ })).toBeVisible();
    await app.page.keyboard.press("Escape");

    expect((await runPackagedCli(home, ["update-channel", "nightly"])).exitCode).toBe(0);
    await openUpdateChannel(app.page);
    await expect(settings.getByText("Switching back to Stable keeps this version")).toBeVisible();

    await settings.getByRole("button", { name: /Nightly/ }).click();
    await app.page.getByRole("menuitemradio", { name: "Stable" }).click();
    await expect.poll(() => readChannelFile(home).channel).toBe("stable");
    expect((await runPackagedCli(home, ["update-channel"])).stdout.trim()).toBe("stable");
  } finally {
    await disposePackagedApp(app);
  }
});

test("Windows offers no update channel", async () => {
  test.skip(process.platform !== "win32", "Only Windows hides the update channel");
  let app: PackagedApp | null = null;
  try {
    const home = createPackagedHome();
    app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    const project = await createPackagedProject(app, "Stable only");
    await openPackagedProject(app.page, project);

    await app.page.getByRole("option", { name: "Settings", exact: true }).click();
    const settings = app.page.getByRole("dialog").filter({ hasText: "Developer tools" });
    await expect(settings.getByRole("option", { name: "Developer tools", exact: true })).toBeVisible();
    await expect(settings.getByText("Update channel", { exact: true })).toHaveCount(0);
    const nightly = await runPackagedCli(home, ["update-channel", "nightly"]);
    expect(nightly.stderr).toContain("Nightly builds are only published for macOS and Linux.");
  } finally {
    await disposePackagedApp(app);
  }
});
