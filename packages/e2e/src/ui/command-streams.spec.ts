import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { writeCommandStreamExtension } from "../helpers/command-stream-extension";
import { folderProjectInput } from "../helpers/folder-project";

test("ten live command readers share one connection and cancel their handlers", async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  const parent = process.env.E2E_FIXTURE_ROOT ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "command-streams-"));
  const source = writeCommandStreamExtension(root);
  const response = await request.post(`${baseURL}/v1/projects`, {
    data: folderProjectInput({ name: "Command streams" }, root),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    const enabled = await request.post(
      `${baseURL}/v1/projects/${project.id}/extensions/installed/stream-fixture/enable`,
      {
        data: {
          displayName: "Stream fixture",
          extensionId: "test.stream-fixture",
          manifest: { id: "test.stream-fixture", name: "stream-fixture" },
          name: "stream-fixture",
          sourceHash: "command-stream-test",
          sourceKind: "local_path",
          sourcePath: source,
          sourceRef: null,
          version: "1.0.0",
        },
      },
    );
    expect(enabled.ok(), await enabled.text()).toBe(true);
    let connections = 0;
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/v1/session-stream" && req.method() === "GET") connections++;
    });
    await page.goto(`/projects/${project.id}/extensions/test.stream-fixture/live`);
    const frame = page.frameLocator('iframe[title="Stream fixture"]');
    await frame.getByRole("button", { name: "Start streams", exact: true }).click();
    await expect(frame.locator("output")).toHaveText("Live 10");
    expect(connections).toBe(1);
    const state = async () => {
      const response = await request.post(
        `${baseURL}/v1/projects/${project.id}/extensions/commands/test.stream-fixture.command.state/execute`,
        { data: {} },
      );
      return (await response.json()).outcome.value;
    };
    await expect.poll(state).toMatchObject({ active: 10, cancelled: 0 });
    await frame.getByRole("button", { name: "Stop streams", exact: true }).click();
    await expect.poll(state, { timeout: 1000, intervals: [20] }).toMatchObject({ active: 0, cancelled: 10 });
    await frame.getByRole("button", { name: "Progress", exact: true }).click();
    await expect(frame.locator("output")).toHaveText('{"chunks":[1,2,3],"result":{"total":3}}');
    const screenshot = testInfo.outputPath("stream-progress.png");
    await page.screenshot({ path: screenshot });
    await testInfo.attach("stream-progress", { path: screenshot, contentType: "image/png" });
    await frame.getByRole("button", { name: "Plain command", exact: true }).click();
    await expect.poll(state).toMatchObject({ active: 1 });
    await page.goto("about:blank");
    await expect.poll(state).toMatchObject({ active: 0, cancelled: 11 });
  } finally {
    await request.delete(`${baseURL}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
