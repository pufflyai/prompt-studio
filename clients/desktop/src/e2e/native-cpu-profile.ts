import { writeFile } from "node:fs/promises";
import { type BrowserContext, type Page, test } from "@playwright/test";
import { redactSensitiveText } from "pstdio-logging";

export const startNativeCpuProfiles = (context: BrowserContext) => {
  const info = test.info();
  const pending: Array<Promise<() => Promise<void>>> = [];
  let stopped: Promise<void> | undefined;
  let index = 0;
  const start = (page: Page) => {
    const name = `native-renderer-${index++}`;
    pending.push(
      (async () => {
        const startedAt = Date.now();
        const session = await context.newCDPSession(page);
        await session.send("Profiler.enable");
        await session.send("Profiler.start");
        return async () => {
          const { profile } = await session.send("Profiler.stop");
          const path = info.outputPath(`${name}.cpuprofile`);
          await writeFile(path, redactSensitiveText(JSON.stringify(profile)));
          await info.attach(name, { path, contentType: "application/json" });
          await info.attach(`${name}-timing`, {
            body: JSON.stringify({ startedAt, stoppedAt: Date.now(), url: page.url() }),
            contentType: "application/json",
          });
          await session.detach();
        };
      })().catch((error) => async () => {
        await info.attach(`${name}-unavailable`, { body: String(error), contentType: "text/plain" });
      }),
    );
  };
  context.on("page", start);
  for (const page of context.pages()) start(page);
  return () => {
    stopped ??= (async () => {
      context.off("page", start);
      for (const stop of await Promise.all(pending)) {
        try {
          await stop();
        } catch (error) {
          await info.attach("native-profile-stop-error", { body: String(error), contentType: "text/plain" });
        }
      }
    })();
    return stopped;
  };
};
