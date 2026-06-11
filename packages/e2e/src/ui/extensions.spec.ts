import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "@playwright/test";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "../default-extensions";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId?: string) => {
  await page.addInitScript((selectedProjectId: string | undefined) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.harness-lab.fake");
    if (!selectedProjectId) return;
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
    );
  }, projectId);
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const createInstalledExtension = (input: { displayName: string; installName: string }) => {
  const home = process.env.E2E_HOME;
  if (!home) throw new Error("E2E_HOME is required for extension uninstall tests.");

  const sourcePath = join(home, "extensions", input.installName);
  rmSync(sourcePath, { recursive: true, force: true });
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    `${JSON.stringify(
      {
        name: input.installName,
        version: "0.0.1",
        displayName: input.displayName,
        publisher: "e2e",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");
  return sourcePath;
};

const extensionsRoot = () => {
  const home = process.env.E2E_HOME;
  if (!home) throw new Error("E2E_HOME is required for extension tests.");
  return join(home, "extensions");
};

const emptyExtensionsRoot = () => {
  const root = extensionsRoot();
  mkdirSync(root, { recursive: true });
  for (const entry of readdirSync(root)) {
    rmSync(join(root, entry), { recursive: true, force: true });
  }
};

const restoreDefaultExtensions = () => {
  const root = extensionsRoot();
  const config = JSON.parse(PSTDIO_E2E_DEFAULT_EXTENSIONS) as {
    defaultExtensions: Array<{ installName: string; source: string }>;
  };

  mkdirSync(root, { recursive: true });
  for (const entry of config.defaultExtensions) {
    const manifest = JSON.parse(readFileSync(join(entry.source, "package.json"), "utf8")) as {
      pstdio?: { scope?: string };
    };
    if (manifest.pstdio?.scope === "repo") continue;
    if (existsSync(join(root, entry.installName))) continue;
    cpSync(entry.source, join(root, entry.installName), {
      filter: (path) => !relative(entry.source, path).replaceAll("\\", "/").split("/").includes("node_modules"),
      recursive: true,
    });
  }
};

const uninstallProjectExtensions = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const listed = await listProjectExtensions(request, projectId);
  for (const extension of listed.extensions) {
    const res = await request.delete(`${apiBase}/v1/projects/${projectId}/extensions/${extension.id}`);
    expect(res.ok()).toBe(true);
  }
};

const writeHotReloadExtension = (input: { command?: boolean; description: string; installName: string }) => {
  const sourcePath = join(extensionsRoot(), input.installName);
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    `${JSON.stringify(
      {
        name: input.installName,
        version: "0.0.1",
        displayName: "Hot Reload Extension",
        description: input.description,
        publisher: "e2e",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `export default {
      commands: ${
        input.command
          ? `{
              "hot-reload": {
                title: "Hot Reload Command",
                palette: { label: "Hot Reload Command", group: "E2E" },
                run: async () => ({ ok: true })
              }
            }`
          : "{}"
      },
    };\n`,
  );
  return sourcePath;
};

const listProjectExtensions = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const res = await request.get(`${apiBase}/v1/projects/${projectId}/extensions`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    extensions: Array<{ id: string; displayName: string; installName: string }>;
  };
};

test("uninstalling an extension removes it from settings and deletes installed files", async ({ page, request }) => {
  const unique = Date.now();
  const installName = `e2e-uninstall-${unique}`;
  const displayName = `E2E Uninstall ${unique}`;
  const project = await createProjectViaApi(request, `Extension Uninstall ${unique}`);
  const sourcePath = createInstalledExtension({ displayName, installName });
  let holdExtensionRefetch = false;
  let heldExtensionRefetch: import("@playwright/test").Route | null = null;

  const initialList = await listProjectExtensions(request, project.id);
  const extension = initialList.extensions.find((entry) => entry.installName === installName);
  expect(extension).toBeDefined();
  expect(existsSync(sourcePath)).toBe(true);

  await bypassOnboarding(page, project.id);
  await page.route(`**/v1/projects/${project.id}/extensions`, async (route) => {
    if (holdExtensionRefetch && !heldExtensionRefetch) {
      heldExtensionRefetch = route;
      return;
    }

    await route.continue();
  });
  await page.goto(`/projects/${project.id}/settings?panel=extensions`);

  const row = page.getByTestId("extension-entry").filter({ hasText: displayName });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Uninstall extension" }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByText("Uninstall extension?")).toBeVisible();
  holdExtensionRefetch = true;
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/v1/projects/${project.id}/extensions/`) && response.request().method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "Uninstall", exact: true }).click();
  expect((await deleteResponse).status()).toBe(204);

  await expect(row).toHaveCount(0);
  await expect
    .poll(() => heldExtensionRefetch !== null, { message: "post-uninstall extensions refetch was not requested" })
    .toBe(true);
  await heldExtensionRefetch?.continue();
  await page.unroute(`**/v1/projects/${project.id}/extensions`);

  expect(existsSync(sourcePath)).toBe(false);

  const nextList = await listProjectExtensions(request, project.id);
  expect(nextList.extensions.find((entry) => entry.installName === installName)).toBeUndefined();
});

test("dashboard-wb hot reloads extension root additions and source edits", async ({ page, request }) => {
  const unique = Date.now();
  const installName = `e2e-hot-reload-${unique}`;
  const project = await createProjectViaApi(request, `Extension Hot Reload ${unique}`);

  try {
    await uninstallProjectExtensions(request, project.id);
    emptyExtensionsRoot();

    await expect.poll(async () => (await listProjectExtensions(request, project.id)).extensions.length).toBe(0);

    await bypassOnboarding(page, project.id);
    await page.goto(`/projects/${project.id}/settings?panel=extensions`);
    await expect(page.getByTestId("extensions-empty")).toBeVisible();

    writeHotReloadExtension({
      description: "Initial hot reload extension.",
      installName,
    });

    const row = page.getByTestId("extension-entry").filter({ hasText: "Hot Reload Extension" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("Initial hot reload extension.");

    const enableResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/v1/projects/${project.id}/extensions/`) &&
        response.request().method() === "PATCH" &&
        response.status() === 200,
    );
    await row.locator("input[type='checkbox']").click({ force: true });
    await enableResponse;

    writeHotReloadExtension({
      command: true,
      description: "Updated hot reload extension.",
      installName,
    });

    await expect(row).toContainText("Updated hot reload extension.", { timeout: 10_000 });

    await page.keyboard.press("Control+Shift+P");
    const paletteInput = page.getByPlaceholder("Search or type > for commands");
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill("> hot reload");
    await expect(page.getByText("Hot Reload Command", { exact: true })).toBeVisible({ timeout: 10_000 });
  } finally {
    restoreDefaultExtensions();
  }
});
