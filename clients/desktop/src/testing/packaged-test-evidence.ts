import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { TestInfo } from "@playwright/test";
import { redactSensitiveText } from "pstdio-logging";

export const attachPackagedLogs = async (
  home: string,
  tokens: string[],
  info: Pick<TestInfo, "outputPath" | "attach">,
) => {
  for (const [name, filename] of [
    ["runtime-log", "logs.jsonl"],
    ["runtime-output", "desktop-runtime.log"],
  ] as const) {
    const source = join(home, filename);
    if (!existsSync(source)) continue;
    const path = info.outputPath(`${basename(home)}-${filename}`);
    writeFileSync(path, redactSensitiveText(readFileSync(source, "utf8"), tokens));
    await info.attach(name, { path, contentType: "text/plain" });
  }
};

export const startupFailure = (error: unknown, home: string, tokens: string[]) => {
  const path = join(home, "desktop-runtime.log");
  const output = existsSync(path) ? readFileSync(path, "utf8").trimEnd().split("\n").slice(-50).join("\n") : "";
  const reason = error instanceof Error ? error.message : String(error);
  return new Error(redactSensitiveText(`${reason}\nLast runtime output lines:\n${output}`, tokens));
};
