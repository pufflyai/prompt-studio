import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Match the upstream Windows npm layout so a private fallback cannot bypass the probe fixture. */
export const installNativeProbeFixture = async (prefix: string, command: string, script: string) => {
  if (command === "pi") {
    const entry = join(prefix, "node_modules", "@mariozechner", "pi-coding-agent", "dist", "cli.js");
    mkdirSync(dirname(entry), { recursive: true });
    copyFileSync(script, entry);
    return;
  }
  const cpu = process.arch === "arm64" ? "aarch64" : "x86_64";
  const locations: Record<string, string[]> = {
    codex: ["@openai", "codex", "vendor", `${cpu}-pc-windows-msvc`, "bin", "codex.exe"],
    claude: ["@anthropic-ai", "claude-code", "bin", "claude.exe"],
    opencode: ["opencode-ai", "bin", "opencode.exe"],
  };
  const entry = join(prefix, "node_modules", ...locations[command]!);
  if (existsSync(entry)) return;
  mkdirSync(dirname(entry), { recursive: true });
  // State changes belong to the script. Keep native launchers unchanged between discovery and recovery.
  const launcher = join(dirname(entry), "probe-launcher.ts");
  writeFileSync(launcher, `const script = ${JSON.stringify(script)}; require(script);`);
  const compiler = Bun.spawn([process.execPath, "build", launcher, "--compile", "--outfile", entry], {
    env: { ...process.env, BUN_BE_BUN: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, error] = await Promise.all([new Response(compiler.stdout).text(), new Response(compiler.stderr).text()]);
  if (await compiler.exited) throw new Error(`Could not compile the ${command} probe fixture: ${error || out}`);
};
