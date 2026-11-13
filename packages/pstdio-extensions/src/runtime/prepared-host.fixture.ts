import { statSync } from "node:fs";
import { loadExtensionPackage } from "./loader";
import { stopExtensionPreparation } from "./preparation-client";
import { acceptPreparedRevision, prepareExtensionRevision, readAcceptedRevision } from "./prepared-revision";

export interface PreparedHostObservation {
  host: { executable: string; executableMtimeMs: number; bunVersion: string; bunRevision: string };
  phases: { name: string; elapsedMs: number; state: "completed" | "failed" }[];
  acceptedBefore?: { id: string; host: string } | null;
  prepared?: { id: string; host: string; entryPath: string };
  artifact?: { ino: number; mtimeMs: number; size: number };
  value?: unknown;
  error?: string;
}

// This entry runs only in a test-owned host, with its own executable and app home.
const observation: PreparedHostObservation = {
  host: {
    executable: process.execPath,
    executableMtimeMs: statSync(process.execPath).mtimeMs,
    bunVersion: Bun.version,
    bunRevision: Bun.revision,
  },
  phases: [],
};
const phase = async <T>(name: string, run: () => Promise<T>) => {
  const started = performance.now();
  const context = { pid: process.pid, name, startedAt: new Date().toISOString() };
  console.log(`PSTDIO_PREPARED_HOST_PHASE ${JSON.stringify({ ...context, state: "started" })}`);
  let state: "completed" | "failed" = "failed";
  try {
    const value = await run();
    state = "completed";
    return value;
  } finally {
    const result = { name, elapsedMs: performance.now() - started, state };
    observation.phases.push(result);
    console.log(`PSTDIO_PREPARED_HOST_PHASE ${JSON.stringify({ ...context, ...result })}`);
  }
};

try {
  const source = process.argv[2]!;
  const accepted = await phase("read-accepted", () => readAcceptedRevision(source));
  observation.acceptedBefore = accepted ? { id: accepted.id, host: accepted.host } : null;
  const prepared = await phase("prepare", () => prepareExtensionRevision(source));
  observation.prepared = { id: prepared.id, host: prepared.host, entryPath: prepared.entryPath };
  await phase("accept", () => acceptPreparedRevision(source, prepared));
  const diagnostics: never[] = [];
  const loaded = await phase("load", () =>
    loadExtensionPackage({ path: source }, diagnostics, { preparedRevision: prepared }),
  );
  if (!loaded || diagnostics.length) throw new Error(JSON.stringify(diagnostics));
  observation.value = await phase("execute", async () => loaded.definition.commands![0].run({} as never, {}));
  const artifact = statSync(prepared.entryPath);
  observation.artifact = { ino: artifact.ino, mtimeMs: artifact.mtimeMs, size: artifact.size };
} catch (error) {
  observation.error = String(error);
  process.exitCode = 1;
} finally {
  try {
    await phase("stop-workers", stopExtensionPreparation);
  } catch (error) {
    observation.error = String(error);
    process.exitCode = 1;
  }
  console.log(`PSTDIO_PREPARED_HOST_OBSERVATION ${JSON.stringify(observation)}`);
}
