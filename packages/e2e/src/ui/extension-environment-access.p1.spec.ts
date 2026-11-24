import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
    );
  }, projectId);
};

// Critical risk: a person must be able to allow and revoke an extension's environment access
// from its details. Without that, a declared provider key can never reach the agent child.
test("revoke an allowed environment grant after the extension removes its requested names", async ({
  page,
  request,
}) => {
  const home = process.env.E2E_HOME;
  if (!home) throw new Error("E2E_HOME is required for extension tests.");
  const unique = Date.now();
  const installName = `e2e-environment-${unique}`;
  const displayName = `E2E Environment ${unique}`;
  const extensionId = `e2e.${installName}`;
  const manifest = {
    name: installName,
    version: "0.0.1",
    displayName,
    publisher: "e2e",
    main: "./extension.ts",
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    pstdio: { processEnvironment: ["E2E_AGENT_KEY", "E2E_OTHER_KEY"] },
  };
  const sourcePath = join(home, "extensions", installName);
  rmSync(sourcePath, { recursive: true, force: true });
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(join(sourcePath, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");

  const project = (await (
    await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name: `Environment ${unique}` }) })
  ).json()) as { id: string };
  const enabled = await request.post(
    `${apiBase}/v1/projects/${project.id}/extensions/installed/${installName}/enable`,
    {
      data: {
        displayName,
        extensionId,
        manifest: { id: extensionId, name: installName, pstdio: manifest.pstdio },
        name: installName,
        sourceHash: null,
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "0.0.1",
      },
    },
  );
  expect(enabled.ok(), await enabled.text()).toBe(true);
  const { instanceId } = (await enabled.json()) as { instanceId: string };
  const permissionUrl = `${apiBase}/v1/projects/${project.id}/extension-process-environment/${extensionId}`;

  await bypassOnboarding(page, project.id);
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  await page.getByTestId("extension-entry").filter({ hasText: displayName }).click();
  const access = page.getByTestId("extension-environment-access");
  await expect(access).toBeVisible();

  await access.getByText("E2E_AGENT_KEY", { exact: true }).click();
  const granted = page.waitForResponse(
    (response) => response.url() === permissionUrl && response.request().method() === "PUT",
  );
  await access.getByTestId("extension-environment-allow").click();
  expect((await granted).status()).toBe(200);
  await expect
    .poll(async () => ((await (await request.get(permissionUrl)).json()) as { granted: string[] }).granted)
    .toEqual(["E2E_AGENT_KEY"]);
  await expect(access.getByTestId("extension-environment-revoke")).toBeEnabled();

  writeFileSync(join(sourcePath, "package.json"), JSON.stringify({ ...manifest, pstdio: {} }));
  const reloaded = await request.post(`${apiBase}/v1/projects/${project.id}/extensions/${instanceId}/reload`);
  expect(reloaded.ok(), await reloaded.text()).toBe(true);
  await expect(access.getByText("E2E_AGENT_KEY", { exact: true })).toHaveCount(0);
  await expect(access.getByTestId("extension-environment-revoke")).toBeEnabled();

  const revoked = page.waitForResponse(
    (response) => response.url() === permissionUrl && response.request().method() === "DELETE",
  );
  await access.getByTestId("extension-environment-revoke").click();
  expect((await revoked).status()).toBe(204);
  await expect
    .poll(async () => ((await (await request.get(permissionUrl)).json()) as { granted: string[] }).granted)
    .toEqual([]);
  await expect(access).toHaveCount(0);
  rmSync(sourcePath, { recursive: true, force: true });
});
