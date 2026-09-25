import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type PlatformPackage = {
  pkg: string;
};

export const preparePackagedSmokeBrowser = (platformPackage: PlatformPackage, binaryPath: string) => {
  if (platformPackage.pkg === "cli-win-arm64") return;

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

export const resolvePackagedRuntimeTestArgs = (platformPackage: PlatformPackage) => {
  if (!platformPackage.pkg.startsWith("cli-win-")) return ["run", "test:packaged"];

  const tests = ["src/packaged/runtime-lifecycle.test.ts"];
  if (platformPackage.pkg === "cli-win-x64") tests.push("src/packaged/extension-browser-install.test.ts");
  return ["test", ...tests, "--timeout", "30000", "--silent"];
};
