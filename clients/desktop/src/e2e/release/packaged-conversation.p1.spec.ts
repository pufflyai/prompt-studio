import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { expect } from "@playwright/test";
import { test } from "../../testing/packaged-fixture";
import { createPackagedHome, disposePackagedApp, launchPackagedApp } from "../packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "../packaged-project-helpers";

const peer = resolve(import.meta.dirname, "../../../../../packages/e2e/src/packaged/packaged-codex.fixture.ts");

const prepareCodex = (home: string) => {
  const tools = join(home, "tools");
  const entry = join(home, "codex.ts");
  const log = join(home, "codex-turns.jsonl");
  mkdirSync(tools);
  writeFileSync(log, "");
  if (process.platform !== "win32") {
    writeFileSync(join(home, ".bash_profile"), 'export PATH="$HOME/tools:$PATH"\n');
  }
  writeFileSync(
    entry,
    `process.env.PSTDIO_CODEX_PEER_LOG = ${JSON.stringify(log)};
process.env.PSTDIO_CODEX_PEER_COMPLETE_TURNS = "1";
await import(${JSON.stringify(peer)});`,
  );
  const executable = join(tools, process.platform === "win32" ? "codex.exe" : "codex");
  execFileSync("bun", ["build", "--compile", entry, "--outfile", executable], { stdio: "inherit" });
  return { tools, log };
};

test("sends a message and a follow-up in the same packaged Codex conversation", async () => {
  test.setTimeout(120_000);
  const home = createPackagedHome();
  const { tools, log } = prepareCodex(home);
  const app = await launchPackagedApp(home, {
    PATH: [tools, process.env.PATH].filter(Boolean).join(delimiter),
    ...(process.platform !== "win32" && { SHELL: "/bin/bash" }),
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(["harness-codex", "pstdio-session-browser"]),
  });
  try {
    const { page } = app;
    const project = await createPackagedProject(app, "Release conversation");
    await openPackagedProject(page, project);
    await page.getByRole("option", { name: "Sessions", exact: true }).click();

    const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
    const send = page.getByTestId("send-message-button").filter({ visible: true }).last();
    const alert = page.getByRole("alert").filter({ hasText: "Could not refresh conversation" });
    const sendAndRead = async (message: string) => {
      await editor.fill(message);
      await expect(send).toBeEnabled({ timeout: 20_000 });
      await send.click();
      await expect(page.getByRole("log").getByText(`Codex replied to "${message}"`, { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(alert).toHaveCount(0);
    };

    await test.step("Send the first message and see the reply", () => sendAndRead("First release message"));
    await test.step("Send a follow-up and see the reply", () => sendAndRead("Release follow-up"));

    const calls = readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { method: string; params?: { threadId?: string } });
    const threadIds = calls.filter(({ method }) => method === "turn/start").map(({ params }) => params?.threadId);
    expect(threadIds).toEqual([expect.any(String), expect.any(String)]);
    expect(threadIds[0]).toBe(threadIds[1]);
    await expect(
      page.getByRole("log").getByText('Codex replied to "First release message"', { exact: true }),
    ).toBeVisible();
    await expect(alert).toHaveCount(0);
  } finally {
    await disposePackagedApp(app);
  }
});
