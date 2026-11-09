import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { writeNativeTerminalExtension } from "../helpers/native-terminal-extension";

// Critical risk: a public native view must keep one live PTY after its opening command returns and its tab moves/hides.
test("an installed public terminal accepts input, resizes, moves, hides, and reports exit", async ({
  page,
  request,
}, info) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "public-native-terminal-")));
  let projectId: string | undefined;
  const opens: unknown[] = [];
  const resizes: unknown[] = [];
  const exits: unknown[] = [];
  page.on("websocket", (socket) => {
    if (!socket.url().includes("/v1/terminal")) return;
    socket.on("framesent", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "openView") opens.push(message);
      if (message.type === "resize") resizes.push(message);
    });
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "exit") exits.push(message);
    });
  });
  try {
    writeNativeTerminalExtension(root);
    const created = await request.post("/v1/projects", {
      data: folderProjectInput({ name: "Public native terminal" }, root),
    });
    expect(created.ok(), await created.text()).toBe(true);
    projectId = (await created.json()).id;
    const installed = await request.post(`/v1/projects/${projectId}/extensions/install`, {
      data: {
        source: { kind: "project-folder", path: "native-terminal", development: true },
        skipInstall: true,
      },
    });
    expect(installed.ok(), await installed.text()).toBe(true);
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id!);
    }, projectId);
    await page.goto(`/projects/${projectId}/extensions/example.native-terminal/console`);
    const opened = page.waitForResponse((response) =>
      response.url().endsWith("/example.native-terminal.command.open/execute"),
    );
    await page.getByRole("option", { name: "Open public shell", exact: true }).click();
    expect((await (await opened).json()).outcome.ok).toBe(true);
    const input = page.getByRole("textbox", { name: "Terminal input" });
    await expect(input).toBeVisible();
    await page.locator(".xterm:visible").click();
    await input.pressSequentially("printf 'NATIVE_PID:%s:OWNER:%s\\n' $$ \"$PSTDIO_NATIVE_VIEW\"; pwd");
    await input.press("Enter");
    const rows = page.locator(".xterm:visible .xterm-rows");
    await expect(rows).toContainText(/NATIVE_PID:\d+:OWNER:public-fixture/);
    await expect(rows).toContainText(root);
    const pid = /NATIVE_PID:(\d+):/.exec(await rows.innerText())![1];
    await expect.poll(() => resizes.length).toBeGreaterThan(0);
    const previousGeometry = JSON.stringify(resizes.at(-1));
    await page.setViewportSize({ width: 1060, height: 740 });
    await expect.poll(() => JSON.stringify(resizes.at(-1))).not.toBe(previousGeometry);
    const header = page.locator('[data-workbench-panel-header="secondary"]');
    await header.getByRole("tab", { name: /Public shell/ }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
    await expect(page.locator('[data-workbench-region="side"] .xterm')).toBeVisible();
    await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
    await expect(page.locator(".xterm:visible")).toHaveCount(0);
    await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
    await page.locator(".xterm:visible").click();
    await input.pressSequentially("printf 'SAME_PID:%s\\n' $$");
    await input.press("Enter");
    await expect(rows).toContainText(`SAME_PID:${pid}`);
    expect(opens).toHaveLength(1);
    const status = await request.post(
      `/v1/projects/${projectId}/extensions/commands/example.native-terminal.command.status/execute`,
      { data: {} },
    );
    expect((await status.json()).outcome.value).toEqual({ opens: 1 });
    await page.screenshot({ path: info.outputPath("native-terminal.png") });
    await input.pressSequentially("exit 7");
    await input.press("Enter");
    await expect.poll(() => exits).toEqual([{ type: "exit", code: 7, signal: null }]);
    await info.attach("native-terminal.png", {
      path: info.outputPath("native-terminal.png"),
      contentType: "image/png",
    });
  } finally {
    try {
      await page.close();
      if (projectId) await request.delete(`/v1/projects/${projectId}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});
