import { beforeAll, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect as expectPage } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

beforeAll(() => {
  if (!process.env.PSTDIO_PACKAGED_BINARY_PATH) buildBinary();
});

const REQUIRE_BROWSER = process.env.PSTDIO_REQUIRE_WEBVIEW_BROWSERS === "1";
const browserAvailable = existsSync(chromium.executablePath());
const browserTest = browserAvailable || REQUIRE_BROWSER ? test : test.skip;
const localExampleSource = resolve(import.meta.dirname, "../../../../infra/local/extensions/local-example");
const localExampleVersion = JSON.parse(readFileSync(join(localExampleSource, "package.json"), "utf8")) as {
  version: string;
};
const cliPackage = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../pstdio/package.json"), "utf8")) as {
  version: string;
};

const runGit = (repo: string, args: string[]) => {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
};

const writeExtension = (
  root: string,
  fixture: { displayName: string; enginesPstdio: string; name: string; version: string },
) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: fixture.name,
        version: fixture.version,
        displayName: fixture.displayName,
        description: `${fixture.displayName} marketplace fixture.`,
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: fixture.enginesPstdio },
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(root, "extension.ts"), "export default {};\n");
};

const writePlanner = (repo: string, version: string, enginesPstdio: string) => {
  writeExtension(join(repo, "extensions", "pstdio-planner"), {
    displayName: "Prompt Studio Planner",
    enginesPstdio,
    name: "pstdio-planner",
    version,
  });
};

const createMarketplaceRepository = (root: string) => {
  const repo = join(root, "marketplace-repo");
  mkdirSync(repo, { recursive: true });
  runGit(repo, ["init"]);
  runGit(repo, ["config", "user.email", "e2e@prompt.studio"]);
  runGit(repo, ["config", "user.name", "Prompt Studio E2E"]);

  writePlanner(repo, "0.10.0", "1.0.0-alpha.1");
  runGit(repo, ["add", "."]);
  runGit(repo, ["commit", "-m", "old planner"]);
  runGit(repo, ["tag", "pstdio@0.26.2"]);

  writePlanner(repo, "0.11.0", EXTENSION_API_VERSION);
  writeExtension(join(repo, "extensions", "pstdio-skills"), {
    displayName: "Prompt Studio Skills",
    enginesPstdio: EXTENSION_API_VERSION,
    name: "pstdio-skills",
    version: "0.4.0",
  });
  runGit(repo, ["add", "."]);
  runGit(repo, ["commit", "-m", "current planner and skills"]);
  runGit(repo, ["tag", `pstdio@${cliPackage.version}`]);
  return repo;
};

// A stale extension already on disk whose database row is created by discovery, so it carries
// no install provenance. The marketplace upgrade must still recover it.
const seedAdoptedSkills = (tempRoot: string) => {
  writeExtension(join(tempRoot, "extensions", "pstdio-skills"), {
    displayName: "Prompt Studio Skills",
    enginesPstdio: "^1.0.0",
    name: "pstdio-skills",
    version: "0.3.0",
  });
};

const createProjectRepository = (root: string) => {
  const repo = join(root, "project-repo");
  mkdirSync(repo, { recursive: true });
  runGit(repo, ["init"]);
  runGit(repo, ["config", "user.email", "e2e@prompt.studio"]);
  runGit(repo, ["config", "user.name", "Prompt Studio E2E"]);
  writeFileSync(join(repo, "README.md"), "# Marketplace upgrade project\n");
  runGit(repo, ["add", "."]);
  runGit(repo, ["commit", "-m", "seed project"]);
  return repo;
};

browserTest("updates an incompatible default extension and reinstalls it from Marketplace", async () => {
  expect(browserAvailable).toBe(true);
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-marketplace-upgrade-"));
  const repository = createMarketplaceRepository(tempRoot);
  const projectRepository = createProjectRepository(tempRoot);
  seedAdoptedSkills(tempRoot);
  let child: ChildProcess | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const started = await startPackagedServe(tempRoot, {
      GIT_ALLOW_PROTOCOL: "file",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: `url.file://${repository}.insteadOf`,
      GIT_CONFIG_VALUE_0: "https://github.com/pufflyai/prompt-studio",
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
        defaultExtensions: [
          { source: "pstdio-planner", ref: "pstdio@0.26.2", skipInstall: true },
          { source: localExampleSource, installName: "local-example", skipInstall: true },
        ],
      }),
    });
    child = started.child;

    const createResponse = await fetch(`${started.baseUrl}/v1/projects`, {
      body: JSON.stringify({ name: "Marketplace Upgrade" }),
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      method: "POST",
    });
    expect(createResponse.status).toBe(201);
    const project = (await createResponse.json()) as {
      extension_warnings?: Array<{ extension: string; message: string }>;
      id: string;
    };
    expect(project.extension_warnings).toBeUndefined();

    const registerRepoResponse = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
      body: JSON.stringify({ name: "project-repo", path: projectRepository }),
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      method: "POST",
    });
    expect(registerRepoResponse.status, await registerRepoResponse.text()).toBe(201);

    const extensionsResponse = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
      headers: runtimeAuthorization(started.descriptor),
    });
    expect(extensionsResponse.status).toBe(200);
    const extensions = (await extensionsResponse.json()) as {
      extensions: Array<{
        canUpgrade: boolean;
        installName: string;
        scope: "global" | "repo";
        status: string;
        version: string | null;
      }>;
    };
    expect(extensions.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ installName: "pstdio-planner", version: "0.10.0" }),
        expect.objectContaining({
          canUpgrade: true,
          installName: "pstdio-skills",
          scope: "global",
          status: "error",
          version: "0.3.0",
        }),
        expect.objectContaining({
          canUpgrade: false,
          installName: "local-example",
          scope: "repo",
          status: "loaded",
          version: localExampleVersion.version,
        }),
      ]),
    );

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb:selected-project:global", projectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${projectId}/values`,
        JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
      );
    }, project.id);
    await page.goto(`${started.baseUrl}/projects/${project.id}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Settings", { exact: true }).last().click();
    const settings = page.getByRole("dialog").last();
    await settings.getByText("Extensions", { exact: true }).first().click();

    const installedRow = page.getByTestId("extension-entry").filter({ hasText: "Prompt Studio Planner" });
    await installedRow.waitFor();
    await installedRow.click();
    await page.getByTestId("extension-upgrade").waitFor();
    await expectPage(page.getByTestId("extension-incompatible-upgrade")).toHaveCount(0);
    await expectPage(page.getByTestId("extension-detail")).toContainText("v0.10.0");

    const updateResponse = page.waitForResponse(
      (response) => response.url().endsWith("/upgrade") && response.request().method() === "POST",
    );
    await page.getByTestId("extension-upgrade").click();
    expect((await updateResponse).status()).toBe(200);
    await expectPage(page.getByTestId("extension-detail")).toContainText("v0.11.0");
    await expectPage(page.getByTestId("extension-detail-health")).toHaveCount(0);
    await expectPage(page.getByTestId("extension-upgrade")).toHaveCount(0);

    await page.getByTestId("extension-detail-back").click();
    const adoptedRow = page.getByTestId("extension-entry").filter({ hasText: "Prompt Studio Skills" });
    await adoptedRow.waitFor();
    await adoptedRow.click();
    await expectPage(page.getByTestId("extension-detail")).toContainText("v0.3.0");
    await expectPage(page.getByTestId("extension-detail-health")).toHaveCount(1);

    const adoptedUpgradeResponse = page.waitForResponse(
      (response) => response.url().endsWith("/upgrade") && response.request().method() === "POST",
    );
    await page.getByTestId("extension-upgrade").click();
    expect((await adoptedUpgradeResponse).status()).toBe(200);
    await expectPage(page.getByTestId("extension-detail")).toContainText("v0.4.0");
    await expectPage(page.getByTestId("extension-detail-health")).toHaveCount(0);
    await expectPage(page.getByTestId("extension-upgrade")).toHaveCount(0);

    await page.getByTestId("extension-detail-back").click();
    const localRow = page.getByTestId("extension-entry").filter({ hasText: "Local Example" });
    await localRow.waitFor();
    await localRow.click();
    await expectPage(page.getByTestId("extension-detail")).toContainText(`v${localExampleVersion.version}`);
    await expectPage(page.getByTestId("extension-detail-health")).toHaveCount(0);
    await expectPage(page.getByTestId("extension-update")).toHaveCount(0);
    await expectPage(page.getByTestId("extension-upgrade")).toHaveCount(0);
    await expectPage(page.getByTestId("extension-incompatible-upgrade")).toHaveCount(0);

    await page.getByTestId("extension-detail-back").click();
    await installedRow.click();

    await page.getByTestId("extension-delete").click();
    const dialog = page.getByRole("dialog").last();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    const marketplaceRow = page
      .getByTestId("marketplace-extension-entry")
      .filter({ has: page.getByText("Prompt Studio Planner", { exact: true }) });
    await marketplaceRow.waitFor();

    const reinstallResponse = page.waitForResponse(
      (response) => response.url().includes("/marketplace/pstdio-planner/install") && response.status() === 200,
    );
    await marketplaceRow.getByTestId("marketplace-extension-install").click();
    await reinstallResponse;
    await page.getByTestId("extension-entry").filter({ hasText: "Prompt Studio Planner" }).waitFor();
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
