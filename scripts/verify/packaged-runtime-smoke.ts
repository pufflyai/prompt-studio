import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const preparePackagedSmokeBrowser = (binaryPath: string) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-browser-setup-"));
  try {
    // Downloads belong to verification setup, outside the runtime tests' fixed deadline.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== "PATH"));
    const setup = spawnSync(binaryPath, ["extensions", "install-browser"], {
      cwd: root,
      env: { ...env, PATH: "", PSTDIO_HOME: join(root, "home") },
      stdio: "inherit",
    });
    if (setup.error) throw setup.error;
    if (setup.status !== 0) throw new Error(`Packaged Chromium setup failed (${setup.status}).`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};
