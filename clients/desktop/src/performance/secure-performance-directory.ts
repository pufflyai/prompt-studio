import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync } from "node:fs";

export const securePerformanceDirectory = (path: string) => {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    chmodSync(path, 0o700);
    return;
  }
  const identity = execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8" });
  const sid = identity.match(/S-1-5-\d+(?:-\d+)+/)?.[0];
  if (!sid) throw new Error("Cannot identify the user for performance diagnostics permissions.");
  // Reset explicit entries, then remove inherited access before writing a credential.
  execFileSync("icacls", [path, "/reset"], { stdio: "pipe" });
  execFileSync("icacls", [path, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], { stdio: "pipe" });
};
