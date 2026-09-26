import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { uiOrigin } from "../ui-server";
import { showHiddenSidenavEntry } from "./helpers/sidenav-navigation";

const source = `
const ready = (providerRef) => ({
  state: "ready", executionKind: "remote", providerRef,
  executionTarget: { kind: "remote", providerId: "example.cloud.workspace-type.remote", providerRef },
  capabilities: { files: "none", diff: false, merge: false, rebase: false, archive: false, delete: true },
});
export default {
  workspaceTypes: [{
    id: "remote", ref: { kind: "workspace-type", id: "remote" }, label: "Test cloud workspace",
    params: { image: { type: "text", label: "Environment image", required: true } },
    create(_ctx, input) {
      if (!input.params.image) throw new Error("Choose an image.");
      return ready({ version: 1, data: { workspaceId: input.workspaceId, image: input.params.image } });
    },
    resolve: (_ctx, input) => ready(input.providerRef),
    delete: async () => {},
  }],
};
`;

test("the global workspace action uses declared cloud parameters without a repository", async ({ page, request }) => {
  // The checkout is mounted at the same path in the isolated Docker host.
  const fixturesRoot = join(import.meta.dirname, "../../../../__test-tmp__/workspace-provider-e2e");
  mkdirSync(fixturesRoot, { recursive: true });
  const sourcePath = mkdtempSync(join(fixturesRoot, "cloud-"));
  writeFileSync(join(sourcePath, "extension.ts"), source);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "cloud",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, { data: { name: "Provider choices" } });
    expect(created.ok(), await created.text()).toBe(true);
    projectId = (await created.json()).id;
    await page.addInitScript((id) => localStorage.setItem("dashboard-wb2:selected-project:global", id), projectId!);
    await page.goto(`/projects/${projectId}`);
    const row = await showHiddenSidenavEntry(page, "Workspaces");
    await row.hover();
    await expect(row.getByRole("button", { name: "New workspace", exact: true })).toHaveCount(0);

    const enabled = await request.post(`${uiOrigin}/v1/projects/${projectId}/extensions/installed/cloud/enable`, {
      data: {
        displayName: "Test cloud workspace",
        extensionId: "example.cloud",
        manifest: { id: "example.cloud", name: "cloud" },
        name: "cloud",
        sourceHash: crypto.randomUUID(),
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "1.0.0",
      },
    });
    expect(enabled.ok(), await enabled.text()).toBe(true);
    await row.hover();
    await row.getByRole("button", { name: "New workspace", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create workspace", exact: true });
    await dialog.getByRole("textbox", { name: "Environment image" }).fill("documents");
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/v1/workspaces" && response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(202);
    expect(response.request().postDataJSON()).toEqual({
      project_id: projectId,
      provider_id: "example.cloud.workspace-type.remote",
      params: { image: "documents" },
    });
    expect(await response.json()).toMatchObject({
      worktree_path: null,
      execution_kind: "remote",
      provider_state: "ready",
      provider_ref_json: { version: 1, data: { image: "documents" } },
    });
    await expect(dialog).not.toBeVisible();
  } finally {
    if (projectId) expect((await request.delete(`${uiOrigin}/v1/projects/${projectId}`)).ok()).toBe(true);
    rmSync(sourcePath, { recursive: true, force: true });
  }
});
