import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { type BrowserContext, test } from "@playwright/test";
import { redactTraceArchive } from "../testing/trace-redaction";

export const startElectronTrace = async (context: BrowserContext, name: string) => {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  let stopped = false;
  return async () => {
    if (stopped) return;
    stopped = true;
    const path = test.info().outputPath(`${name}.zip`);
    try {
      await context.tracing.stop({ path });
      writeFileSync(path, redactTraceArchive(readFileSync(path)));
      await test.info().attach(name, { path, contentType: "application/zip" });
    } catch {
      rmSync(path, { force: true });
      await test.info().attach(`${name}-unavailable`, {
        body: "Could not save the Electron browser trace.",
        contentType: "text/plain",
      });
    }
  };
};
