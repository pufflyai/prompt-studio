import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
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

const directoryIdentity = (path: string) => {
  const { dev, ino } = statSync(path, { bigint: true });
  return { dev, ino };
};

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
    // realpath can retain a SUBST alias, while file identifiers identify the same directory.
    await expect.poll(async () => directoryIdentity(await folderPath.inputValue())).toEqual(directoryIdentity(folder));
    await picker.getByRole("option", { name: "My tools", exact: true }).press("Enter");
    await expect
      .poll(async () => directoryIdentity(await folderPath.inputValue()))
      .toEqual(directoryIdentity(join(folder, "My tools")));
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
    const workspaces = (await (
      await fetch(`${app.runtime.origin}/v1/workspaces?project_id=${project.id}`, { headers })
    ).json()) as { root_path: string }[];
    expect(workspaces).toHaveLength(1);
    expect(directoryIdentity(workspaces[0]!.root_path)).toEqual(directoryIdentity(join(folder, "My tools")));
  } finally {
    try {
      await disposePackagedApp(app);
    } finally {
      unmapDrive();
      await removePackagedHome(home);
    }
  }
});
