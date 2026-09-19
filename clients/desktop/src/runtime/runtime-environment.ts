import { spawn } from "node:child_process";
import { userInfo } from "node:os";
import { basename } from "node:path";

const OUTPUT_LIMIT = 1024 * 1024;

const readShellPath = (shell: string, env: NodeJS.ProcessEnv, signal: AbortSignal) => {
  signal.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(shell, ["-ic", "/usr/bin/printf '\\000'; /usr/bin/printenv PATH; /usr/bin/printf '\\000'"], {
      // A login argv[0] also works for csh/tcsh, whose -l flag cannot be combined with -c.
      argv0: `-${basename(shell)}`,
      cwd: env.HOME,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    const cancel = () => {
      if (child.pid === undefined) return;
      try {
        // Interactive shells can ignore SIGTERM. Own the group so startup children stop too.
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") reject(error);
      }
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(-OUTPUT_LIMIT);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      signal.removeEventListener("abort", cancel);
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve(stdout);
      else reject(new Error(`Shell exited with code ${code}`));
    });
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
};

export const resolveRuntimeEnvironment = async (
  signal: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
) => {
  if (platform === "win32") return { ...env };

  const shell = env.SHELL || userInfo().shell || "/bin/sh";
  try {
    // Interactive login startup includes user-managed tools such as nvm and Bun.
    // NUL framing separates PATH from greetings printed by shell startup files.
    const stdout = await readShellPath(shell, env, signal);
    const path = stdout.split("\0")[1]?.replace(/\n$/, "");
    if (!path) throw new Error("The login shell did not return PATH.");

    // Shell startup must not redirect the runtime home, credentials, or settings.
    return { ...env, PATH: path };
  } catch {
    signal.throwIfAborted();
    throw new Error(
      `unexpected_exit: Could not load the executable search path from ${shell}. Check your shell startup configuration.`,
    );
  }
};
