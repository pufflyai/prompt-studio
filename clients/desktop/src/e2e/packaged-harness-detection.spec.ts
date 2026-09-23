import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  runPackagedCli,
} from "./packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "./packaged-project-helpers";

for (const shell of ["/bin/bash", "/bin/zsh", "/bin/csh", "/bin/tcsh"]) {
  test(`selects shell-installed harnesses after a desktop launch with ${shell}`, async () => {
    test.skip(process.platform === "win32" || !existsSync(shell), `${shell} is not available on this platform.`);
    const home = createPackagedHome();
    const toolsPath = join(home, "agent tools");
    mkdirSync(toolsPath);
    const bunPath = execFileSync("bun", ["-e", "process.stdout.write(process.execPath)"], { encoding: "utf8" });
    for (const executable of ["codex", "claude", "opencode"]) {
      writeFileSync(join(toolsPath, executable), `#!${bunPath}\nconsole.log("1.0.0");\n`, { mode: 0o755 });
    }
    writeFileSync(join(home, ".bash_profile"), 'source "$HOME/.bashrc"\n');
    writeFileSync(join(home, ".bashrc"), 'export PATH="$HOME/agent tools:$PATH"\n');
    writeFileSync(join(home, ".zshrc"), 'export PATH="$HOME/agent tools:$PATH"\n');
    writeFileSync(join(home, ".cshrc"), 'setenv PATH "$HOME/agent tools:$PATH"\n');
    const harnessPackages = ["harness-codex", "harness-claude-code", "harness-open-code"];
    let app: PackagedApp | null = null;
    try {
      app = await launchPackagedApp(home, {
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        SHELL: shell,
        ZDOTDIR: home,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
          defaultExtensions: harnessPackages.map((installName) => ({
            installName,
            source: resolve(import.meta.dirname, "../../../../extensions", installName),
            skipInstall: true,
          })),
        }),
      });
      const agents = await app.page.evaluate(async () => {
        const response = await fetch("/v1/agents/info");
        return { status: response.status, body: await response.json() };
      });
      expect(agents.status).toBe(200);
      expect(agents.body).toHaveLength(3);
      expect(agents.body).toEqual(
        expect.arrayContaining(
          ["Codex", "Claude Code", "OpenCode"].map((name) =>
            expect.objectContaining({ name, availability: { type: "INSTALLED" } }),
          ),
        ),
      );
      const cli = await runPackagedCli(home, ["agents", "list"]);
      expect(cli.exitCode).toBe(0);
      expect(cli.stdout).toContain("Codex");
      expect(cli.stdout.match(/\byes\b/g)).toHaveLength(3);
      const project = await createPackagedProject(app, "Harness selection");
      await openPackagedProject(app.page, project);
      await app.page.emulateMedia({ reducedMotion: "reduce" });
      await app.page.getByRole("option", { name: "Sessions", exact: true }).click();
      const modelMenu = app.page.getByRole("button", { name: "Select model", exact: true });
      const conversationHeading = app.page.getByRole("heading", { name: "No active conversations", exact: true });
      await expect(modelMenu).not.toContainText("Loading");
      for (const name of ["Claude Code", "OpenCode", "Codex"]) {
        await modelMenu.click();
        await app.page.getByRole("menuitem", { name: "Select harness", exact: true }).click({ timeout: 5_000 });
        const option = app.page.getByTestId("workspace-agent-options").getByRole("menuitem", { name, exact: true });
        await expect(option).toBeEnabled();
        await option.click();
        await conversationHeading.click();
        await expect(app.page.getByRole("menuitem", { name: "Select harness", exact: true })).not.toBeVisible();
        await modelMenu.click();
        await expect(app.page.getByRole("menuitem", { name: "Select harness", exact: true })).toContainText(name);
        await conversationHeading.click();
        await expect(app.page.getByRole("menuitem", { name: "Select harness", exact: true })).not.toBeVisible();
      }
      await modelMenu.click();
      await app.page.getByRole("menuitem", { name: "Select harness", exact: true }).click();
      await test.info().attach("selectable-harnesses", { body: await app.page.screenshot(), contentType: "image/png" });
    } finally {
      await disposePackagedApp(app);
    }
  });
}
