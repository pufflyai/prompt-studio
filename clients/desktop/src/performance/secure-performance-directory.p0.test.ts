import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { securePerformanceDirectory } from "./secure-performance-directory";

test.skipIf(process.platform !== "win32")("secures diagnostics without relying on tools in PATH", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-permissions-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `import { securePerformanceDirectory } from ${JSON.stringify(join(import.meta.dirname, "secure-performance-directory.ts"))}; securePerformanceDirectory(process.argv[1]);`,
        join(root, "diagnostics"),
      ],
      { env: { ...process.env, PATH: root }, encoding: "utf8" },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.skipIf(process.platform === "win32")("keeps existing diagnostics private on POSIX", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-permissions-"));
  try {
    securePerformanceDirectory(root);
    expect(statSync(root).mode & 0o777).toBe(0o700);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
