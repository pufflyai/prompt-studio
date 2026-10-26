import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CompilerObservation } from "../extension-compiler-observations";
import {
  benchmarkOutput,
  type MeasurementMode,
  measurementMetadata,
  startResponsivenessHost,
  waitFor,
} from "./responsiveness-driver.fixture";
import {
  createResponsivenessFixtures,
  enableBody,
  exportsPerModule,
  sharedModuleCount,
  viewCount,
  writeSharedRevision,
} from "./responsiveness-fixtures.fixture";
import { probeDuring, summarizeProbes } from "./responsiveness-samples";

const output = benchmarkOutput("builds");
mkdirSync(output, { recursive: true });
await Bun.write(
  join(output, "metadata.json"),
  JSON.stringify(
    { ...(await measurementMetadata()), viewCount, sharedModuleCount, exportsPerModule, watcherDebounceMs: 100 },
    null,
    2,
  ),
);

const activeCompilers = (events: CompilerObservation[]) => {
  const active = new Set<string>();
  for (const event of events) {
    if (event.phase === "spawned") active.add(event.id);
    if (event.phase === "exited") active.delete(event.id);
  }
  return active.size;
};

const runTrial = async (trial: number, mode: MeasurementMode) => {
  const root = mkdtempSync(join(output, `trial-${trial}-${mode}-`));
  const { sourcePath } = createResponsivenessFixtures(root, true);
  const host = await startResponsivenessHost(root, mode, true);
  const results: unknown[] = [];
  const enable = (name: string) =>
    host.json(`/v1/projects/${host.projectId}/extensions/installed/${name}/enable`, enableBody(root, name));
  let installedId = "";
  const outputFiles = () =>
    Array.from({ length: viewCount }, (_, i) =>
      join(root, "home", "cache", "extension-webviews", installedId, `test.work.view.view${i}`, "dist", "module.js"),
    );
  const observed = new Map<string, { key: string; content: string }>();
  const outputsContain = (revision: number) =>
    outputFiles().every((path) => {
      if (!existsSync(path)) return false;
      const stat = statSync(path);
      const key = `${stat.mtimeMs}:${stat.size}:${stat.ino}`;
      if (observed.get(path)?.key !== key) observed.set(path, { key, content: readFileSync(path, "utf8") });
      return observed.get(path)!.content.includes(`revision-${String(revision).padStart(6, "0")}`);
    });
  const fingerprints = () => outputFiles().map((path) => createHash("sha256").update(readFileSync(path)).digest("hex"));
  const extensionState = async () =>
    (await host.json(`/v1/projects/${host.projectId}/extensions`)).extensions.find(
      (item: { installedExtensionId: string }) => item.installedExtensionId === installedId,
    );
  const phase = async (name: string, work: () => Promise<void>) => {
    await host.control("reset");
    const measurement = await probeDuring(host.probes, work);
    const stats = await host.control("stats");
    const spawned = stats.compilers.filter((event) => event.phase === "spawned");
    const exited = stats.compilers.filter((event) => event.phase === "exited" && event.pid !== undefined);
    const cpuWindow =
      spawned.length && exited.length
        ? {
            startedAt: Math.min(...spawned.map((event) => event.at)),
            endedAt: Math.max(...exited.map((event) => event.at)),
          }
        : null;
    const result = {
      name,
      ...measurement,
      stats,
      compilersSpawned: spawned.length,
      cancelledCompilers: exited.filter((event) => event.cancelled).length,
      actualCompilerWindow: cpuWindow,
      probesDuringCompilers: cpuWindow ? summarizeProbes(measurement.samples, cpuWindow) : null,
    };
    results.push(result);
    await Bun.write(join(root, `${name}.json`), JSON.stringify(result, null, 2));
    return result;
  };
  try {
    await enable("probe");
    await phase("cold", async () => {
      const work = await enable("work");
      installedId = work.installedExtensionId;
      await waitFor(() => outputsContain(0), "cold six-view output");
    });
    const unchanged = await phase("unchanged-save", async () => {
      writeFileSync(join(sourcePath, "shared.ts"), readFileSync(join(sourcePath, "shared.ts")));
      await Bun.sleep(500);
      if (!outputsContain(0)) throw new Error("Unchanged save replaced working output");
    });
    if (unchanged.compilersSpawned !== 0) throw new Error("An unchanged save spawned a compiler");
    await phase("shared-edit", async () => {
      writeSharedRevision(sourcePath, 1);
      await waitFor(() => outputsContain(1), "shared same-size edit output");
    });
    const rapidSaves: { revision: number; at: number; activeCompilers: number }[] = [];
    await phase("five-rapid-edits", async () => {
      const start = host.compilerEvents.length;
      rapidSaves.push({ revision: 2, at: Date.now(), activeCompilers: 0 });
      writeSharedRevision(sourcePath, 2);
      await waitFor(() => activeCompilers(host.compilerEvents.slice(start)) > 0, "first rapid-edit compiler starts");
      for (let revision = 3; revision <= 6; revision++) {
        const active = activeCompilers(host.compilerEvents.slice(start));
        if (!active) throw new Error("Rapid-edit fixture did not overlap subsequent saves with a real compiler");
        rapidSaves.push({ revision, at: Date.now(), activeCompilers: active });
        writeSharedRevision(sourcePath, revision);
        await Bun.sleep(5);
      }
      await waitFor(() => outputsContain(6), "latest rapid-edit output");
    });
    const beforeFailure = fingerprints();
    await phase("invalid-edit", async () => {
      writeSharedRevision(sourcePath, 7, true);
      await waitFor(
        async () => (await extensionState()).lastError?.code === "extension_webview_build_failed",
        "matching failed-edit diagnostic",
      );
      if (JSON.stringify(fingerprints()) !== JSON.stringify(beforeFailure))
        throw new Error("Failed edit replaced working output");
    });
    await phase("repair", async () => {
      writeSharedRevision(sourcePath, 8);
      await waitFor(() => outputsContain(8), "repaired six-view output");
      await waitFor(async () => (await extensionState()).lastError === null, "repair clears its diagnostic");
    });
    const result = { trial, mode, root, rapidSaves, results };
    await Bun.write(join(root, "result.json"), JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    await Bun.write(
      join(root, "failure.json"),
      JSON.stringify(
        {
          trial,
          mode,
          error: error instanceof Error ? error.stack : String(error),
          results,
          host: await host.control("stats").catch(() => null),
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await host.close();
  }
};

const trials = [];
for (let trial = 1; trial <= 3; trial++) {
  const modes: MeasurementMode[] = trial % 2 ? ["inline", "owner"] : ["owner", "inline"];
  for (const mode of modes) {
    const result = await runTrial(trial, mode);
    trials.push(result);
    console.log(
      JSON.stringify({
        trial,
        mode,
        phases: result.results.map((phase) => {
          const measured = phase as {
            name: string;
            window: { startedAt: number; endedAt: number };
            probes: unknown;
            compilersSpawned: number;
            cancelledCompilers: number;
          };
          return {
            name: measured.name,
            elapsedMs: measured.window.endedAt - measured.window.startedAt,
            probes: measured.probes,
            compilers: measured.compilersSpawned,
            cancelledCompilers: measured.cancelledCompilers,
          };
        }),
      }),
    );
  }
}
await Bun.write(join(output, "results.json"), JSON.stringify(trials, null, 2));
