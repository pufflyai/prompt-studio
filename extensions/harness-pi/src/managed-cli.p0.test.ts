import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePiCommand } from "./cli";

test("a private Pi script runs with bundled Bun and does not pass Bun mode to child tools", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-private-"));
  const entry = join(root, "cli.ts");
  writeFileSync(entry, 'console.log(JSON.stringify({version:"0.73.1",bunMode:process.env.BUN_BE_BUN??null}));');
  try {
    const resolved = resolvePiCommand({ which: () => null, managed: () => entry });
    const child = Bun.spawn([...resolved.command, "--version"], {
      env: { PATH: "/usr/bin:/bin", ...resolved.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(JSON.parse(await new Response(child.stdout).text())).toEqual({ version: "0.73.1", bunMode: null });
    expect(await child.exited).toBe(0);
    expect(resolvePiCommand({ which: () => "/global/pi", managed: () => entry }).command).toEqual(["/global/pi"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Windows Pi npm shims use their existing script with Bun", () => {
  const entry = "C:\\tools\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js";
  expect(
    resolvePiCommand({
      which: () => "C:\\tools\\pi.cmd",
      platform: "win32",
      exists: (path) => path === entry,
      managed: () => "private",
    }).command.at(-1),
  ).toBe(entry);
});
