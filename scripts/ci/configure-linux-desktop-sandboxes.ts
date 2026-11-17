import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export const configureLinuxDesktopSandboxes = (root: string) => {
  if (process.platform !== "linux") return;
  const desktop = resolve(root, "clients/desktop");
  execFileSync("bun", ["-e", 'require("electron")'], { cwd: desktop, stdio: "inherit" });
  for (const sandbox of [
    resolve(desktop, `out/prompt-studio-linux-${process.arch}/chrome-sandbox`),
    resolve(desktop, "node_modules/electron/dist/chrome-sandbox"),
  ]) {
    execFileSync("sudo", ["-n", "chown", "root:root", sandbox], { stdio: "inherit" });
    execFileSync("sudo", ["-n", "chmod", "4755", sandbox], { stdio: "inherit" });
  }
};

if (import.meta.main) configureLinuxDesktopSandboxes(resolve(import.meta.dirname, "../.."));
