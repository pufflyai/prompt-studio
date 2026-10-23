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

// Hosted Intel macOS runners are slow and vary about 2x between runs, so timing races in the large UI
// suite failed release checks there that Linux and Apple Silicon passed. Like the desktop release's
// @essential set, Intel proves the x64 CLI, runtime and extension pages work; the other platforms run
// the full suite. Intel keeps the 60 s per-test limit the user approved on 2026-10-12.
const INTEL_MAC_ESSENTIAL_TESTS = [
  "src/packaged/packaged.test.ts",
  "src/packaged/runtime-lifecycle.test.ts",
  "src/packaged/performance-observer.test.ts",
  "src/packaged/npm-entrypoint.test.ts",
  "src/packaged/harness-npm-detection.test.ts",
  "src/packaged/codex-transport.test.ts",
  "src/packaged/extension-smoke.test.ts",
  "src/packaged/extension-browser-install.test.ts",
  "src/packaged/extension-dependency-loading.test.ts",
];

export const resolvePackagedRuntimeTestArgs = (platformPackage: PlatformPackage) => {
  if (platformPackage.pkg === "cli-darwin-x64")
    return ["test", ...INTEL_MAC_ESSENTIAL_TESTS, "--timeout", "60000", "--silent"];
  if (!platformPackage.pkg.startsWith("cli-win-")) return ["run", "test:packaged"];

  const tests = [
    "src/packaged/runtime-lifecycle.test.ts",
    "src/packaged/performance-observer.test.ts",
    "src/packaged/harness-npm-detection.test.ts",
    "src/packaged/codex-transport.test.ts",
  ];
  if (platformPackage.pkg === "cli-win-x64") tests.push("src/packaged/extension-browser-install.test.ts");
  return ["test", ...tests, "--timeout", "30000", "--silent"];
};
