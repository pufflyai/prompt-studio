import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { configureLinuxDesktopSandboxes } from "./configure-linux-desktop-sandboxes";

const root = resolve(import.meta.dirname, "../..");
if (!process.argv.includes("--prebuilt"))
  execFileSync("bun", ["run", "--cwd", "clients/desktop", "package"], { cwd: root, stdio: "inherit" });
execFileSync("bun", ["clients/desktop/scripts/verify-test-package.ts"], { cwd: root, stdio: "inherit" });
configureLinuxDesktopSandboxes(root);
