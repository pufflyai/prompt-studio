import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  benchmarkOutput,
  type MeasurementMode,
  measurementMetadata,
  startResponsivenessHost,
  waitFor,
} from "./responsiveness-driver.fixture";
import {
  checksumEntry,
  checksumIterations,
  createResponsivenessFixtures,
  enableBody,
  expectedChecksum,
  initializationIterations,
} from "./responsiveness-fixtures.fixture";
import { probeDuring, summarizeProbes } from "./responsiveness-samples";

const output = benchmarkOutput("isolation");
mkdirSync(output, { recursive: true });
await Bun.write(join(output, "metadata.json"), JSON.stringify(await measurementMetadata(), null, 2));
const trials: Awaited<ReturnType<typeof runTrial>>[] = [];

const runTrial = async (trial: number, mode: MeasurementMode) => {
  const root = mkdtempSync(join(output, `trial-${trial}-${mode}-`));
  const { sourcePath } = createResponsivenessFixtures(root, false);
  const host = await startResponsivenessHost(root, mode, false);
  const enable = (name: string) =>
    host.json(`/v1/projects/${host.projectId}/extensions/installed/${name}/enable`, enableBody(root, name));
  try {
    await enable("probe");
    const work = await enable("work");
    await host.control("reset");
    const compute = await probeDuring(host.probes, () => host.json(host.commandPath("work", "compute"), {}));
    const computed = compute.value.outcome;
    if (!computed.ok || computed.value.checksum !== expectedChecksum(checksumIterations))
      throw new Error("Checksum command returned an incorrect result");
    if (mode === "owner" && computed.value.pid === host.pid) throw new Error("Command ran on the API process");
    const persisted = await host.json(host.commandPath("work", "read"), {});
    if (!isDeepStrictEqual(persisted.outcome.value, computed.value))
      throw new Error("Host storage did not retain the computed result");
    const computeHost = await host.control("stats");
    const computeActualCpu = summarizeProbes(compute.samples, computed.value);

    await host.control("reset");
    writeFileSync(
      join(sourcePath, "extension.ts"),
      checksumEntry(initializationIterations, join(root, "loop-started")),
    );
    const reload = await probeDuring(host.probes, () =>
      host.json(`/v1/projects/${host.projectId}/extensions/${work.instanceId}/reload`, {}),
    );
    if (reload.value.status !== "loaded")
      throw new Error(`Reload did not adopt the initialized candidate (${reload.value.status})`);
    const initialized = await host.json(host.commandPath("work", "initialization"), {});
    if (
      !initialized.outcome.ok ||
      initialized.outcome.value.iterations !== initializationIterations ||
      initialized.outcome.value.checksum !== expectedChecksum(initializationIterations)
    )
      throw new Error("Reload did not run the unchanged initialization workload");
    const reloadHost = await host.control("stats");
    const reloadActualCpu = summarizeProbes(reload.samples, initialized.outcome.value);

    let recovery: { elapsedMs: number; completion: unknown } | null = null;
    if (mode === "owner") {
      const executionPath = `/v1/projects/${host.projectId}/extensions/${work.instanceId}/execution`;
      const shared = await host.json(executionPath);
      if (
        !shared.available ||
        !shared.affectedProjects.some((project: { id: string }) => project.id === host.projectId)
      )
        throw new Error("Execution controls did not identify the affected project");
      const loop = host.json(host.commandPath("work", "loop"), {}).catch((error: Error) => ({ error: error.message }));
      await waitFor(() => existsSync(join(root, "loop-started")), "infinite command starts executing");
      const startedAt = performance.now();
      await host.json(executionPath, { action: "stop" });
      const completion = await loop;
      await host.json(executionPath, { action: "restart" });
      const fresh = await host.json(host.commandPath("work", "read"), {});
      if (!fresh.outcome.ok || !isDeepStrictEqual(fresh.outcome.value, computed.value))
        throw new Error("Fresh invocation did not recover persisted host storage");
      recovery = { elapsedMs: performance.now() - startedAt, completion };
    }
    const result = {
      trial,
      mode,
      root,
      apiPid: host.pid,
      compute,
      computeActualCpu,
      computeHost,
      reload,
      reloadActualCpu,
      initialized: initialized.outcome.value,
      reloadHost,
      recovery,
      recoveryControl: "Authenticated host execution endpoint, Stop/Restart and fresh persisted read through HTTP",
    };
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

for (let trial = 1; trial <= 3; trial++) {
  const modes: MeasurementMode[] = trial % 2 ? ["inline", "owner"] : ["owner", "inline"];
  for (const mode of modes) {
    const result = await runTrial(trial, mode);
    trials.push(result);
    console.log(
      JSON.stringify({
        trial,
        mode,
        computeMs: result.compute.window.endedAt - result.compute.window.startedAt,
        probes: result.compute.probes,
        reloadProbes: result.reload.probes,
        recoveryMs: result.recovery?.elapsedMs,
      }),
    );
  }
}
await Bun.write(join(output, "results.json"), JSON.stringify(trials, null, 2));
