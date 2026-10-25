import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Windows uses one native recursive watcher and does not scan dependency directories.
test.skipIf(process.platform === "win32")("keeps watching when dependencies disappear during refresh", async () => {
  const source = mkdtempSync(join(tmpdir(), "extension-dependency-removal-"));
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        "--conditions=source",
        join(import.meta.dirname, "extension-source-watcher-removal.fixture.ts"),
        "watch",
        source,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [status, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(status, stderr || stdout).toBe(0);
  } finally {
    rmSync(source, { recursive: true, force: true });
  }
});
