import { spawn } from "node:child_process";
import { join } from "node:path";
import { version } from "playwright-core/package.json";
import { resolvePstdioHome } from "pstdio-paths";

export const installSmokeBrowser = async (input: { withDeps: boolean }) => {
  const child = spawn(
    process.execPath,
    [
      "x",
      "--bun",
      `playwright@${version}`,
      "install",
      "chromium",
      "--no-shell",
      ...(input.withDeps ? ["--with-deps"] : []),
    ],
    {
      env: {
        ...process.env,
        BUN_BE_BUN: "1",
        BUN_INSTALL_CACHE_DIR:
          process.env.BUN_INSTALL_CACHE_DIR ?? join(resolvePstdioHome(), "cache", "extension-browser-install"),
      },
      stdio: "inherit",
    },
  );
  return new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
};
