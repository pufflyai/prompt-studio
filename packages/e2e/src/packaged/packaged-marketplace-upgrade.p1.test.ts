import { beforeAll, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as expectPage } from "@playwright/test";
import type { ListProjectExtensionsResponse } from "pstdio-api-contracts";
import { extensionUpgradeNeedsReviewCode } from "pstdio-api-contracts/extension-host";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { logTestPhase } from "../scripts/log-test-phase";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { buildBinary, runPackagedAsync } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

const REQUIRE_BROWSER = process.env.E2E_REQUIRE_WEBVIEW_BROWSERS === "1";
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
    displayName: "Project Planner",
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

  writePlanner(repo, "0.10.0", "^0.0.9");
  runGit(repo, ["add", "."]);
  runGit(repo, ["commit", "-m", "old planner"]);
  runGit(repo, ["tag", "pstdio@0.26.2"]);

  writePlanner(repo, "0.11.0", `^${EXTENSION_API_VERSION}`);
  writeExtension(join(repo, "extensions", "pstdio-skills"), {
    displayName: "Prompt Studio Skills",
    enginesPstdio: `^${EXTENSION_API_VERSION}`,
    name: "pstdio-skills",
    version: "0.4.0",
  });
  runGit(repo, ["add", "."]);
  runGit(repo, ["commit", "-m", "current planner and skills"]);
  runGit(repo, ["tag", `pstdio@${cliPackage.version}`]);
  return repo;
};

// Discovery registers the existing source without install provenance. Recovery requires review.
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

test("upgrades UI Canvas with its standalone webview dependencies", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-canvas-upgrade-"));
  let child: ChildProcess | undefined;
  try {
    const repository = createProjectRepository(join(root, "catalog"));
    const canvasPath = "extensions/canvas";
    const target = join(repository, canvasPath);
    const previousVersion = "0.0.0";
    writeExtension(target, {
      displayName: "UI Canvas",
      enginesPstdio: `^${EXTENSION_API_VERSION}`,
      name: "canvas",
      version: previousVersion,
    });
    runGit(repository, ["add", "."]);
    runGit(repository, ["commit", "-m", "previous Canvas"]);
    runGit(repository, ["tag", "canvas-previous"]);

    const source = resolve(import.meta.dirname, "../../../..", canvasPath);
    const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8")) as {
      files: string[];
      version: string;
    };
    for (const file of ["package.json", ...manifest.files])
      cpSync(join(source, file), join(target, file), { recursive: true });
    runGit(repository, ["add", "."]);
    runGit(repository, ["commit", "-m", "current Canvas"]);
    runGit(repository, ["tag", "canvas-current"]);

    const catalog = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../../pstdio-api/files/extension-catalog.json"), "utf8"),
    );
    const canvas = catalog.extensions.find((entry: { installName: string }) => entry.installName === "canvas");
    canvas.origin.url = pathToFileURL(repository).href;
    const catalogPath = join(root, "catalog.json");
    writeFileSync(catalogPath, JSON.stringify({ ...catalog, extensions: [canvas] }));
    const runtime = await startPackagedServe(root, {
      PSTDIO_EXTENSION_CATALOG: catalogPath,
      PSTDIO_EXTENSION_RELEASE_REF: "canvas-current",
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
        defaultExtensions: [{ source: "canvas", ref: "canvas-previous", skipInstall: true }],
      }),
    });
    child = runtime.child;
    const headers = runtimeAuthorization(runtime.descriptor);
    const projectPath = createProjectRepository(root);
    const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Canvas Upgrade" }, projectPath)),
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const listCanvas = async () => {
      const response = await fetch(`${runtime.baseUrl}/v1/projects/${id}/extensions`, { headers });
      expect(response.status).toBe(200);
      const { extensions } = (await response.json()) as ListProjectExtensionsResponse;
      return extensions.find((extension) => extension.installName === "canvas");
    };
    const previous = await listCanvas();
    expect(previous).toMatchObject({ version: previousVersion, canUpgrade: true });

    const output = await runPackagedAsync(["extensions", "update", "canvas", "--project-id", id], projectPath, {
      PSTDIO_HOME: root,
      PSTDIO_API_URL: runtime.baseUrl,
      PSTDIO_API_TOKEN: runtime.descriptor.token,
    });
    expect(output).toContain(`Updated canvas to ${manifest.version}.`);
    // The host only activates a replacement after building all of its managed webviews.
    expect(await listCanvas()).toMatchObject({
      id: previous!.id,
      version: manifest.version,
      enabled: true,
      status: "loaded",
      canUpgrade: false,
    });
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});

browserTest("updates an incompatible default extension and reinstalls it from Marketplace", async () => {
  const startedAt = Date.now();
  const phase = (name: string) => logTestPhase(`Marketplace upgrade: ${name} (+${Date.now() - startedAt}ms)`);
  expect(browserAvailable).toBe(true);
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-marketplace-upgrade-"));
  const repository = createMarketplaceRepository(tempRoot);
  const projectRepository = createProjectRepository(tempRoot);
  seedAdoptedSkills(tempRoot);
  let child: ChildProcess | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const catalogPath = join(tempRoot, "catalog.json");
    const catalog = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../../pstdio-api/files/extension-catalog.json"), "utf8"),
    );
    for (const entry of catalog.extensions) entry.origin.url = pathToFileURL(repository).href;
    writeFileSync(catalogPath, JSON.stringify(catalog));
    const [runtime, launched] = await Promise.allSettled([
      startPackagedServe(tempRoot, {
        PSTDIO_EXTENSION_CATALOG: catalogPath,
        // A nightly binary bakes a main commit that this fixture repository cannot contain,
        // so the host release ref points at the fixture's tag for the current version.
        PSTDIO_EXTENSION_RELEASE_REF: `pstdio@${cliPackage.version}`,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
          defaultExtensions: [
            { source: "pstdio-planner", ref: "pstdio@0.26.2", skipInstall: true },
            { source: localExampleSource, installName: "local-example", skipInstall: true },
          ],
        }),
      }),
      chromium.launch(PACKAGED_DASHBOARD_BROWSER),
    ]);
    if (runtime.status === "fulfilled") child = runtime.value.child;
    if (launched.status === "fulfilled") browser = launched.value;
    if (runtime.status === "rejected" || launched.status === "rejected")
      throw new AggregateError(
        [runtime, launched].flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
        "Could not start Marketplace runtime and browser",
      );
    const started = runtime.value;
    phase("runtime and cold browser ready");

    const createResponse = await fetch(`${started.baseUrl}/v1/projects`, {
      body: JSON.stringify(folderProjectInput({ name: "Marketplace Upgrade" }, projectRepository)),
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      method: "POST",
    });
    expect(createResponse.status).toBe(201);
    const project = (await createResponse.json()) as {
      extension_warnings?: Array<{ extension: string; message: string }>;
      id: string;
    };
    expect(project.extension_warnings).toBeUndefined();

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
        expect.objectContaining({ installName: "planner", version: "0.10.0" }),
        expect.objectContaining({
          canUpgrade: true,
          installName: "skills",
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

    phase("project and installed extensions ready");
    const page = await launched.value.newPage();
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${projectId}/values`,
        JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
      );
    }, project.id);
    await signInBrowser(page, started.descriptor, `/projects/${project.id}`);
    phase("browser signed in at project home");
    await page.getByRole("option", { name: "Extensions", exact: true }).click();

    phase("Extensions list open");
    const detail = page.getByTestId("extension-detail").filter({ visible: true });
    const list = page.getByTestId("extensions-panel").filter({ visible: true });
    const installedRow = list.getByTestId("extension-entry").filter({ hasText: "Project Planner" });
    await installedRow.waitFor();
    await installedRow.click();
    await detail.getByTestId("extension-upgrade").waitFor();
    await expectPage(detail.getByTestId("extension-incompatible-upgrade")).toHaveCount(0);
    await expectPage(detail).toContainText("v0.10.0");

    const updateResponse = page.waitForResponse(
      (response) => response.url().endsWith("/upgrade") && response.request().method() === "POST",
    );
    await detail.getByTestId("extension-upgrade").click();
    expect((await updateResponse).status()).toBe(200);
    phase("planner upgrade response");
    await expectPage(detail).toContainText("v0.11.0");
    await expectPage(detail.getByTestId("extension-detail-health")).toHaveCount(0);
    await expectPage(detail.getByTestId("extension-upgrade")).toHaveCount(0);

    // Recovery must leave the breadcrumb return path available to pointer users.
    const extensionsBreadcrumb = page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("button", { name: "Extensions", exact: true });
    await extensionsBreadcrumb.click({ timeout: 5_000 });
    phase("planner recovered and breadcrumb returned");
    const adoptedRow = list.getByTestId("extension-entry").filter({ hasText: "Prompt Studio Skills" });
    await adoptedRow.waitFor();
    await adoptedRow.click();
    await expectPage(detail).toContainText("v0.3.0");
    await expectPage(detail.getByTestId("extension-detail-health")).toHaveCount(1);
    await expectPage(detail.getByTestId("extension-health-upgrade")).toHaveCount(1);

    const adoptedUpgradeResponse = page.waitForResponse(
      (response) => response.url().endsWith("/upgrade") && response.request().method() === "POST",
    );
    await detail.getByTestId("extension-upgrade").click();
    const adoptedResponse = await adoptedUpgradeResponse;
    expect(adoptedResponse.status()).toBe(409);
    expect(await adoptedResponse.json()).toMatchObject({ code: extensionUpgradeNeedsReviewCode });
    await expectPage(detail).toContainText("v0.3.0");
    await detail.getByRole("button", { name: /Review upgrade/ }).click();
    const review = page.getByRole("dialog", { name: "Review Prompt Studio Skills upgrade" });
    await expectPage(review).toContainText("Original release unavailable");
    const apply = review.getByRole("button", { name: "Apply upgrade" });
    await expectPage(apply).toBeDisabled();
    await review.getByRole("button", { name: "Use incoming" }).click();
    await expectPage(apply).toBeEnabled();
    await apply.click();
    await expectPage(review).toHaveCount(0);
    phase("reviewed skills upgrade applied");
    await expectPage(detail).toContainText("v0.4.0");
    phase("adopted skills version displayed");
    await expectPage(detail.getByTestId("extension-detail-health")).toHaveCount(0);
    phase("adopted skills health cleared");
    await expectPage(detail.getByTestId("extension-upgrade")).toHaveCount(0);
    phase("adopted skills recovery controls cleared");

    await extensionsBreadcrumb.click({ timeout: 5_000 });
    phase("skills recovered and breadcrumb returned");
    const localRow = list.getByTestId("extension-entry").filter({ hasText: "Local Example" });
    await localRow.waitFor();
    await localRow.click();
    await expectPage(detail).toContainText(`v${localExampleVersion.version}`);
    await expectPage(detail.getByTestId("extension-detail-health")).toHaveCount(0);
    await expectPage(detail.getByTestId("extension-reload")).toHaveCount(0);
    await expectPage(detail.getByTestId("extension-upgrade")).toHaveCount(0);
    await expectPage(detail.getByTestId("extension-incompatible-upgrade")).toHaveCount(0);

    await extensionsBreadcrumb.click({ timeout: 5_000 });
    await installedRow.click();
    phase("local source verified; planner selected for reinstall");

    await detail.getByTestId("extension-delete").click();
    const dialog = page.getByRole("dialog").last();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    const marketplaceRow = page
      .getByTestId("marketplace-extension-entry")
      .filter({ visible: true })
      .filter({ has: page.getByText("Project Planner", { exact: true }) });
    await marketplaceRow.waitFor();
    phase("planner uninstalled");

    const reinstallResponse = page.waitForResponse(
      (response) => response.url().endsWith("/extensions/install") && response.status() === 201,
    );
    await marketplaceRow.getByTestId("marketplace-extension-install").click();
    await reinstallResponse;
    await list.getByTestId("extension-entry").filter({ hasText: "Project Planner" }).waitFor();
    phase("planner reinstalled");
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(tempRoot, { recursive: true, force: true });
    phase("cleanup complete");
  }
});
