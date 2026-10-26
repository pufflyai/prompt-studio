import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = "clients/desktop/src/cli/windows-user-path.ts";
const original = readFileSync(file, "utf8");
const observed = original
  .replace(
    "  const { stdout } = await execute(",
    '  const startedAt = performance.now();\n  const phase = script.includes("$next =") ? "write-and-notify" : "read";\n  console.error("PS932 PowerShell started", phase, new Date().toISOString());\n  const { stdout } = await execute(',
  )
  .replace(
    "  return stdout.trim();",
    '  console.error("PS932 PowerShell finished", phase, performance.now() - startedAt);\n  return stdout.trim();',
  );
if (observed === original) throw new Error("Windows PATH observer did not match the baseline");
writeFileSync(file, observed);
try {
  const child = Bun.spawn(
    [
      process.execPath,
      "../../scripts/ci/run-bun-tests.ts",
      "./src/cli/windows-user-path.p0.test.ts",
      "--timeout=15000",
    ],
    {
      cwd: join(process.cwd(), "clients/desktop"),
      env: { ...process.env },
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  process.exitCode = await child.exited;
} finally {
  writeFileSync(file, original);
}
