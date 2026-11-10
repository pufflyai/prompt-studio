import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { resolveClaudeCommand } from "./cli";

interface QuotaResponse {
  request_id?: string;
  subtype?: string;
  response?: Record<string, unknown>;
}

const quotaResponse = (line: string) => {
  try {
    const message = JSON.parse(line) as { type?: string; response?: QuotaResponse };
    const response = message?.response;
    if (
      message?.type === "control_response" &&
      response &&
      ["quota-initialize", "quota-read"].includes(response.request_id ?? "")
    )
      return response;
  } catch {}
  return undefined;
};

export const readClaudeUsage = async (parentSignal?: AbortSignal, command = [resolveClaudeCommand()]) => {
  const signal = AbortSignal.any([AbortSignal.timeout(5_000), ...(parentSignal ? [parentSignal] : [])]);
  signal.throwIfAborted();
  const child = spawn(
    command[0]!,
    [
      ...command.slice(1),
      "--print",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--setting-sources",
      "",
      "--no-session-persistence",
    ],
    {
      cwd: tmpdir(),
      env: { ...process.env, CLAUDECODE: "" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32" && /[.](cmd|bat)$/i.test(command[0]!),
    },
  );
  const reader = createInterface({ input: child.stdout });
  const failed = Promise.withResolvers<never>();
  const exited = new Promise<void>((resolve) => {
    child.once("close", () => resolve());
    child.once("error", () => {
      failed.reject(new Error("Claude quota process failed."));
      resolve();
    });
  });
  const failInput = () => failed.reject(new Error("Claude quota input closed."));
  child.stdin.on("error", failInput);
  child.stderr.resume();
  const abort = () => {
    failed.reject(signal.reason);
    child.kill();
    reader.close();
  };
  signal.addEventListener("abort", abort, { once: true });
  const send = (id: string, subtype: string, fields: Record<string, unknown> = {}) =>
    child.stdin.write(
      `${JSON.stringify({ type: "control_request", request_id: id, request: { subtype, ...fields } })}\n`,
    );
  const read = async () => {
    send("quota-initialize", "initialize");
    for await (const line of reader) {
      const response = quotaResponse(line);
      if (!response) continue;
      if (response.subtype !== "success") throw new Error("Claude quota read was rejected.");
      if (response.request_id === "quota-initialize") send("quota-read", "get_usage", { skip_behaviors: true });
      else {
        if (!response.response) throw new Error("Claude returned no quota data.");
        return response.response;
      }
    }
    throw new Error("Claude closed before returning account quotas.");
  };
  try {
    return await Promise.race([read(), failed.promise]);
  } finally {
    signal.removeEventListener("abort", abort);
    reader.close();
    child.kill();
    const force = setTimeout(() => child.kill("SIGKILL"), 1_000);
    try {
      await exited;
    } finally {
      clearTimeout(force);
    }
  }
};
