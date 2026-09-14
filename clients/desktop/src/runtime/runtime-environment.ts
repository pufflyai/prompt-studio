import { execFile } from "node:child_process";
import { userInfo } from "node:os";
import { promisify } from "node:util";

const runFile = promisify(execFile);

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
    const { stdout } = await runFile(shell, ["-ilc", "printf '\\000'; /usr/bin/printenv PATH; printf '\\000'"], {
      cwd: env.HOME,
      env,
      encoding: "utf8",
      signal,
    });
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
