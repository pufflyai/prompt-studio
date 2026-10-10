import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect as expectPage } from "@playwright/test";
import { serializePageUrl, workbenchPages } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const source = `
const ready = (providerRef) => ({
  state: "ready", executionKind: "remote", providerRef,
  executionTarget: { kind: "remote", providerId: "example.cloud.workspace-type.remote", providerRef },
  capabilities: { files: "none", diff: false, merge: false, rebase: false, archive: false, delete: true },
});
export default { workspaceTypes: [{
  id: "remote", ref: { kind: "workspace-type", id: "remote" }, label: "Cloud workspace",
  create: (_ctx, input) => ready({ version: 1, data: { workspaceId: input.workspaceId } }),
  resolve: (_ctx, input) => ready(input.providerRef),
  delete: async () => {},
}] };
`;

export const registerWorkspaceCapabilitiesSmokeTests = () => {
  test("packaged remote workspace shows its state and actions without requesting files", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-workspace-capabilities-"));
    let child: ChildProcess | undefined;
    const browser = await chromium.launch();
    try {
      const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      child = runtime.child;
      const headers = runtimeAuthorization(runtime.descriptor);
      const jsonHeaders = { ...headers, "content-type": "application/json" };
      const folder = join(root, "project");
      const extensionPath = join(root, "cloud");
      mkdirSync(folder);
      mkdirSync(extensionPath);
      writeFileSync(join(extensionPath, "extension.ts"), source);
      writeFileSync(
        join(extensionPath, "package.json"),
        JSON.stringify({
          name: "cloud",
          publisher: "example",
          version: "1.0.0",
          main: "./extension.ts",
          type: "module",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(folderProjectInput({ name: "Workspace capabilities" }, folder)),
      });
      expect(created.status).toBe(201);
      const { id: projectId } = (await created.json()) as { id: string };
      const enabled = await fetch(`${runtime.baseUrl}/v1/projects/${projectId}/extensions/installed/cloud/enable`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          displayName: "Cloud workspace",
          extensionId: "example.cloud",
          manifest: { id: "example.cloud", name: "cloud" },
          name: "cloud",
          sourceHash: crypto.randomUUID(),
          sourceKind: "local_path",
          sourcePath: extensionPath,
          sourceRef: null,
          version: "1.0.0",
        }),
      });
      expect(enabled.ok).toBe(true);
      const workspace = await fetch(`${runtime.baseUrl}/v1/workspaces`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ project_id: projectId, provider_id: "example.cloud.workspace-type.remote", params: {} }),
      });
      expect(workspace.status).toBe(202);
      const { id: workspaceId } = (await workspace.json()) as { id: string };
      const page = await browser.newPage({ extraHTTPHeaders: headers });
      const fileRequests: string[] = [];
      page.on("request", (request) => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith(`/v1/workspaces/${workspaceId}/`) && /\/(files|file)$/.test(path)) fileRequests.push(path);
      });
      await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
      const workspaceUrl = serializePageUrl({
        projectId,
        page: { id: "workspace", ref: workbenchPages.workspace, path: "workspace" },
        resource: { type: "workspace", id: workspaceId },
      });
      await page.goto(new URL(workspaceUrl, runtime.baseUrl).href);
      await expectPage(page.getByText("Workspace state: Ready", { exact: true })).toBeVisible();
      await expectPage(page.getByRole("region", { name: "Files", exact: true })).toHaveCount(0);
      await expectPage(page.getByText("Select a file", { exact: true })).toHaveCount(0);
      await expectPage(page.getByRole("button", { name: "Delete workspace", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Rename workspace", exact: true }).click();
      await expectPage(page.getByRole("dialog", { name: "Rename workspace", exact: true })).toBeVisible();
      expect(fileRequests).toEqual([]);
    } finally {
      await browser.close();
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
