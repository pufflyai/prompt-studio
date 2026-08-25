import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const commandId = "ps-256-files.inspect";

const deleteAllProjects = async (request: APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createProject = async (request: APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-256 Command Files" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const createFilesExtension = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-ps-256-files-"));
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "ps-256-files",
      version: "1.0.0",
      displayName: "PS-256 Files",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "1.0.0-alpha.3" },
      type: "module",
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      commands: {
        inspect: {
          title: "Inspect uploaded files",
          description: "Reads browser files after the dashboard uploads them.",
          params: {
            files: {
              type: "files",
              label: "Data files",
              description: "Choose CSV files to inspect.",
              required: true,
              multiple: true,
              accept: ".csv",
            },
          },
          palette: { label: "Inspect uploaded files", group: "Files" },
          async run(ctx: any, commandParams: any) {
            const files = await Promise.all(
              commandParams.files.map(async (id: string) => ({
                id,
                text: new TextDecoder().decode(await ctx.storage.files.getBytes(id)),
              })),
            );
            return { files };
          },
        },
      },
    };`,
  );
  return root;
};

const enableExtension = async (request: APIRequestContext, projectId: string, sourcePath: string) => {
  const response = await request.post(`${apiBase}/v1/projects/${projectId}/extensions/installed/ps-256-files/enable`, {
    data: {
      displayName: "PS-256 Files",
      extensionId: "pstdio.ps-256-files",
      manifest: { id: "pstdio.ps-256-files", name: "ps-256-files" },
      name: "ps-256-files",
      sourceHash: "ps-256-files-e2e",
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: "1.0.0",
    },
  });
  expect(response.ok()).toBe(true);
};

const prepareDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

test("PS-256 uploads file parameters before extension command execution", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  const extensionRoot = createFilesExtension();

  try {
    await enableExtension(request, project.id, extensionRoot);
    await expect
      .poll(async () => {
        const response = await request.get(`${apiBase}/v1/projects/${project.id}/extensions/ui`);
        if (!response.ok()) return false;
        const metadata = (await response.json()) as { commands: Array<{ id: string }> };
        return metadata.commands.some((command) => command.id === commandId);
      })
      .toBe(true);

    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole("button", { name: /PS-256 Command Files/ })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+KeyK");
    const palette = page.getByRole("dialog");
    await palette.getByRole("textbox").fill("> inspect uploaded files");
    await palette.getByText("Inspect uploaded files", { exact: true }).click();

    const dialog = page.getByRole("dialog");
    const input = dialog.locator('input[type="file"]');
    const run = dialog.getByRole("button", { name: "Run", exact: true });
    await expect(dialog.getByText("Data files *", { exact: true })).toBeVisible();
    await expect(input).toHaveAttribute("accept", ".csv");
    await expect(input).toHaveAttribute("multiple", "");
    await expect(run).toBeDisabled();

    await input.setInputFiles([
      { name: "first.csv", mimeType: "text/csv", buffer: Buffer.from("first row") },
      { name: "second.csv", mimeType: "text/csv", buffer: Buffer.from("second row") },
    ]);
    await expect(run).toBeEnabled();

    const uploadResponses: import("@playwright/test").Response[] = [];
    page.on("response", (response) => {
      if (new URL(response.url()).pathname.endsWith(`/extensions/commands/${commandId}/files`)) {
        uploadResponses.push(response);
      }
    });
    const executeResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith(`/extensions/commands/${commandId}/execute`),
    );
    await run.click();

    const executeResponse = await executeResponsePromise;
    expect(executeResponse.ok()).toBe(true);
    await expect.poll(() => uploadResponses.length).toBe(2);
    expect(uploadResponses).toHaveLength(2);
    for (const response of uploadResponses) expect(response.ok()).toBe(true);

    const requestBody = executeResponse.request().postDataJSON() as { params: { files: unknown[] } };
    expect(requestBody.params.files).toHaveLength(2);
    expect(requestBody.params.files.every((value) => typeof value === "string")).toBe(true);
    const result = (await executeResponse.json()) as {
      outcome: { ok: boolean; value: { files: Array<{ id: string; text: string }> } };
    };
    expect(result.outcome.ok).toBe(true);
    expect(result.outcome.value.files.map((file) => file.text)).toEqual(["first row", "second row"]);
    await expect(dialog).not.toBeVisible();
  } finally {
    rmSync(extensionRoot, { recursive: true, force: true });
  }
});
