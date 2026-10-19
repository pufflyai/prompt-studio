import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { registerPackagedCleanup, test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
} from "./packaged-app-helpers";

test("opens a project from another Windows drive through the folder picker", async () => {
  test.skip(process.platform !== "win32", "Drive-letter selection belongs to Windows hosts.");
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  let mappedLetter: string | undefined;
  const subst = join(process.env.SystemRoot!, "System32", "subst.exe");
  const unmapDrive = () => {
    if (!mappedLetter) return;
    expect(spawnSync(subst, [mappedLetter, "/D"]).status).toBe(0);
    mappedLetter = undefined;
  };
  try {
    app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    const headers = { authorization: `Bearer ${app.runtime.token}` };
    const { drives } = (await (await fetch(`${app.runtime.origin}/v1/filesystem/drives`, { headers })).json()) as {
      drives: { name: string; path: string }[];
    };
    const letter = Array.from({ length: 26 }, (_, index) => `${String.fromCharCode(90 - index)}:`).find(
      (name) => !drives.some((drive) => drive.name === name),
    );
    expect(letter).toBeDefined();
    const folder = join(home, "drive-folders");
    mkdirSync(join(folder, "My tools"), { recursive: true });
    expect(spawnSync(subst, [letter!, folder]).status).toBe(0);
    mappedLetter = letter;
    registerPackagedCleanup(unmapDrive);

    const page = app.page;
    await page.getByRole("button", { name: "Create project", exact: true }).click();
    const picker = page.getByRole("dialog").filter({ hasText: "Open project folder" });
    const drive = picker.getByRole("button", { name: "Drive", exact: true });
    await drive.click();
    await page.getByRole("menuitem", { name: letter!, exact: true }).click();
    const folderPath = picker.getByRole("textbox", { name: "Folder path", exact: true });
    // The picker may retain the selected drive alias; compare the filesystem identity.
    await expect.poll(async () => realpathSync(await folderPath.inputValue())).toBe(realpathSync(`${letter}\\`));
    await picker.getByRole("option", { name: "My tools", exact: true }).press("Enter");
    await expect
      .poll(async () => realpathSync(await folderPath.inputValue()))
      .toBe(realpathSync(join(folder, "My tools")));
    await test.info().attach("windows-drive-picker", { body: await picker.screenshot(), contentType: "image/png" });
    const opening = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/v1/projects" && response.request().method() === "POST",
    );
    await picker.getByRole("button", { name: "Open folder", exact: true }).click();
    const response = await opening;
    expect(response.status()).toBe(201);
    const project = (await response.json()) as { id: string; name: string };
    expect(project.name).toBe("My tools");
    await expect(picker).toBeHidden();
    const workspaces = await (
      await fetch(`${app.runtime.origin}/v1/workspaces?project_id=${project.id}`, { headers })
    ).json();
    expect(workspaces).toContainEqual(expect.objectContaining({ root_path: realpathSync(join(folder, "My tools")) }));
  } finally {
    try {
      await disposePackagedApp(app);
    } finally {
      unmapDrive();
      await removePackagedHome(home);
    }
  }
});
