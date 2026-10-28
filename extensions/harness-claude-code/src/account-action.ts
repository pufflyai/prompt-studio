import { spawn } from "node:child_process";
import type { HarnessAuthenticationChannel } from "@pstdio/sdk/extensions";
import { resolveClaudeCommand } from "./cli";

/** Claude exposes auth through its CLI. Only the browser link and code prompt cross the account channel. */
export const runClaudeAccountLogin = async (
  method: string,
  channel: HarnessAuthenticationChannel,
  command = [resolveClaudeCommand(), "auth", "login", method === "console" ? "--console" : "--claudeai"],
) => {
  channel.signal.throwIfAborted();
  const child = spawn(command[0]!, command.slice(1), {
    stdio: "pipe",
    env: { ...process.env, CLAUDECODE: "", BROWSER: process.platform === "win32" ? "cmd /c exit 0" : "true" },
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });
  const link = Promise.withResolvers<string>();
  void link.promise.catch(() => {});
  let output = "";
  let found = false;
  const read = (chunk: Buffer) => {
    if (found) return;
    output = Bun.stripANSI(output + chunk.toString()).slice(-65536);
    const match = /https:\/\/[^\s]+(?=\s)/.exec(output);
    if (match) {
      found = true;
      link.resolve(match[0]);
    }
  };
  child.stdout.on("data", read);
  child.stderr.on("data", read);
  const abort = () => {
    child.kill();
    link.reject(channel.signal.reason);
  };
  channel.signal.addEventListener("abort", abort, { once: true });
  const success = exited.then((code) => {
    channel.signal.throwIfAborted();
    if (code !== 0) throw new Error("Claude sign-in failed. Try signing in again.");
  });
  try {
    const url = await Promise.race([
      link.promise,
      success.then(() => {
        throw new Error("Claude closed before providing a sign-in link.");
      }),
    ]);
    await channel.emit({ type: "browser", url });
    await Promise.race([
      success,
      channel
        .request({ type: "input", title: "Paste the authorization code from Claude", secret: true })
        .then((code) => {
          channel.signal.throwIfAborted();
          child.stdin.write(code + "\n");
        }),
    ]);
    await success;
  } finally {
    channel.signal.removeEventListener("abort", abort);
    child.kill();
    await exited.catch(() => {});
  }
};
