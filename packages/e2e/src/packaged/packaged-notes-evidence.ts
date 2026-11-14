import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";

const readFixtureFiles = async (folder: string | undefined) => {
  const files: Record<string, string> = {};
  if (!folder) return files;
  for (const owner of ["pstdio.notes", "pstdio.pstdio-notes"]) {
    const cwd = join(folder, ".pstdio/extension-storage", owner, "documents");
    if (!existsSync(cwd)) continue;
    for await (const file of new Bun.Glob("*/content.md").scan({ cwd }))
      files[`${owner}/${file}`] = await Bun.file(join(cwd, file)).text();
  }
  return files;
};

/** Observe the fixture without submitting an edit, requesting a flush, or refreshing its tree. */
export const observePackagedNotes = async (page: Page) => {
  const began = performance.now();
  const exchanges: unknown[] = [];
  const pending = new Set<Promise<void>>();
  const response = (reply: import("@playwright/test").Response) => {
    const path = new URL(reply.url()).pathname;
    if (
      !path.startsWith("/v1/") ||
      path.endsWith("/stream") ||
      reply.headers()["content-type"]?.includes("text/event-stream") ||
      (!path.includes("/text-editing") && !path.includes("/extensions/"))
    )
      return;
    const request = reply.request();
    let operation: unknown;
    try {
      operation = request.postDataJSON()?.request?.operation;
    } catch {}
    const work = (async () => {
      const body = (await reply.text().catch(() => "response body unavailable")).slice(0, 8192);
      exchanges.push({
        elapsedMs: Math.round(performance.now() - began),
        path,
        operation,
        status: reply.status(),
        body,
      });
    })();
    pending.add(work);
    void work.finally(() => pending.delete(work));
  };
  page.on("response", response);
  const tracing = await page
    .context()
    .tracing.start({ screenshots: true, snapshots: true, sources: true })
    .then(
      () => true,
      (error) => {
        console.warn("Cloud Notes trace could not start", error);
        return false;
      },
    );
  return async (folder: string | undefined, failed: boolean) => {
    page.off("response", response);
    const evidence = join(import.meta.dirname, "../../test-results/cloud-notes-failure");
    try {
      if (!failed) return;
      await mkdir(evidence, { recursive: true });
      const files = await readFixtureFiles(folder);
      await Promise.allSettled([...pending]);
      await writeFile(join(evidence, "observed.json"), JSON.stringify({ exchanges, files }, null, 2));
    } catch (error) {
      console.warn("Cloud Notes failure evidence could not be saved", error);
    } finally {
      if (tracing)
        await page
          .context()
          .tracing.stop(failed ? { path: join(evidence, "trace.zip") } : {})
          .catch((error) => console.warn("Cloud Notes trace could not stop", error));
    }
  };
};
