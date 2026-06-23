import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installLocalPstdio } from "./local-pstdio-install";

describe("installLocalPstdio", () => {
  test("installs a dev-server wrapper that runs the local CLI with dev server env", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-local-install-"));
    try {
      const installDir = join(root, "bin");
      const fakeBinDir = join(root, "fake-bin");
      const outputPath = join(root, "fake-bun-output.txt");
      mkdirSync(fakeBinDir);

      const fakeBunPath = join(fakeBinDir, "bun");
      writeFileSync(
        fakeBunPath,
        [
          "#!/bin/sh",
          "{",
          "printf 'PSTDIO_HOME=%s\\n' \"$PSTDIO_HOME\"",
          "printf 'PSTDIO_API_URL=%s\\n' \"$PSTDIO_API_URL\"",
          "printf 'PSTDIO_DISABLE_API_AUTO_START=%s\\n' \"$PSTDIO_DISABLE_API_AUTO_START\"",
          "printf 'PSTDIO_DISABLE_EMBED_MANIFEST=%s\\n' \"$PSTDIO_DISABLE_EMBED_MANIFEST\"",
          "printf 'argv=%s\\n' \"$*\"",
          `} > "${outputPath}"`,
        ].join("\n"),
      );
      chmodSync(fakeBunPath, 0o755);

      const { destination } = installLocalPstdio({
        installDir,
        repoRoot: root,
        mode: { type: "dev-server", apiUrl: "http://127.0.0.1:4173" },
        pathEnv: installDir,
      });

      const { PSTDIO_HOME: _pstdioHome, ...env } = process.env;
      const result = spawnSync(destination, ["tickets", "list"], {
        env: { ...env, PATH: `${fakeBinDir}:${process.env.PATH ?? ""}` },
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      const lines = readFileSync(outputPath, "utf8").split("\n");

      expect(lines.find((line) => line.startsWith("PSTDIO_HOME="))).toEndWith("/.pstdio-dev");
      expect(lines).toEqual(
        expect.arrayContaining([
          "PSTDIO_API_URL=http://127.0.0.1:4173",
          "PSTDIO_DISABLE_API_AUTO_START=1",
          "PSTDIO_DISABLE_EMBED_MANIFEST=1",
          `argv=${join(root, "packages/pstdio/src/index.ts")} tickets list`,
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
