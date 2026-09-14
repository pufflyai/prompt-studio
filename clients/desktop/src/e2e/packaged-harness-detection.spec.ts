import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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

test("detects installed harnesses from a desktop launcher and the attached CLI", async () => {
  test.skip(process.platform === "win32", "Windows does not use POSIX shell startup.");
  const home = createPackagedHome();
  const toolsPath = join(home, "agent tools");
  mkdirSync(toolsPath);
  const bunPath = execFileSync("bun", ["-e", "process.stdout.write(process.execPath)"], { encoding: "utf8" });
  for (const executable of ["codex", "claude", "opencode"]) {
    writeFileSync(join(toolsPath, executable), `#!${bunPath}\nconsole.log("1.0.0");\n`, { mode: 0o755 });
  }
  writeFileSync(join(home, ".bash_profile"), 'source "$HOME/.bashrc"\n');
  writeFileSync(join(home, ".bashrc"), 'export PATH="$HOME/agent tools:$PATH"\n');
  const harnessPackages = ["harness-codex", "harness-claude-code", "harness-open-code"];
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home, {
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      SHELL: "/bin/bash",
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
  } finally {
    await disposePackagedApp(app);
  }
});
