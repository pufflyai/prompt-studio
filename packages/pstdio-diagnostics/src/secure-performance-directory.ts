import { execFile } from "node:child_process";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

export const securePerformanceDirectory = async (path: string) => {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    await chmod(path, 0o700);
    return;
  }
  // Git for Windows also ships whoami. Use the OS tools regardless of PATH order.
  const systemDirectory = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
  const { stdout: identity } = await executeFile(join(systemDirectory, "whoami.exe"), ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const sid = identity.match(/S-1-5-\d+(?:-\d+)+/)?.[0];
  if (!sid) throw new Error("Cannot identify the user for performance diagnostics permissions.");
  // Reset explicit entries, then remove inherited access before writing a credential.
  const icacls = join(systemDirectory, "icacls.exe");
  await executeFile(icacls, [path, "/reset"], { windowsHide: true });
  await executeFile(icacls, [path, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], { windowsHide: true });
};
