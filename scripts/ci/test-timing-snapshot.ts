import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export interface TestTimingObservation {
  kind: "file" | "package";
  key: string;
  profile: string;
  host: string;
  configuration: string;
  coverage: boolean;
  durationMs: number;
  samples: number;
  observedAt: string;
  sourceSha: string;
  provenance: string;
}
export interface TestTimingSnapshot {
  version: 1;
  capturedAt: string;
  observations: TestTimingObservation[];
}
export const readTestTimingSnapshot = (path: string, root: string) => {
  const snapshot = JSON.parse(readFileSync(path, "utf8")) as TestTimingSnapshot;
  if (
    snapshot.version !== 1 ||
    !Number.isFinite(Date.parse(snapshot.capturedAt)) ||
    !Array.isArray(snapshot.observations)
  )
    throw new Error("Invalid timing snapshot");
  const keys = new Set<string>();
  for (const observation of snapshot.observations) {
    if (observation.kind === "file") {
      const file = observation.key.replaceAll("\\", "/");
      observation.key = isAbsolute(file)
        ? relative(root, resolve(file)).replaceAll("\\", "/")
        : file.replace(/^\.\//, "");
      if (observation.key.startsWith("../") || observation.key.split("/").includes(".."))
        throw new Error("Timing file is outside the checkout");
    }
    const key = JSON.stringify([
      observation.kind,
      observation.key,
      observation.profile,
      observation.host,
      observation.configuration,
      observation.coverage,
    ]);
    if (
      keys.has(key) ||
      !["file", "package"].includes(observation.kind) ||
      !observation.key ||
      !observation.profile ||
      !observation.host ||
      !observation.configuration ||
      typeof observation.coverage !== "boolean" ||
      !Number.isFinite(observation.durationMs) ||
      observation.durationMs < 0 ||
      !Number.isInteger(observation.samples) ||
      observation.samples < 1 ||
      !Number.isFinite(Date.parse(observation.observedAt)) ||
      Date.parse(observation.observedAt) > Date.parse(snapshot.capturedAt) ||
      !observation.sourceSha ||
      !observation.provenance
    )
      throw new Error("Invalid or duplicate timing observation");
    keys.add(key);
  }
  return snapshot;
};
export const compatibleTestTimings = (
  snapshot: TestTimingSnapshot | undefined,
  context: {
    kind: TestTimingObservation["kind"];
    profile: string;
    host: string;
    configuration: string;
    coverage: boolean;
  },
) =>
  Object.fromEntries(
    (snapshot?.observations ?? [])
      .filter(
        (observation) =>
          observation.kind === context.kind &&
          observation.profile === context.profile &&
          observation.host === context.host &&
          observation.configuration === context.configuration &&
          observation.coverage === context.coverage &&
          Date.parse(snapshot!.capturedAt) - Date.parse(observation.observedAt) <= 30 * 24 * 60 * 60 * 1000,
      )
      .map((observation) => [observation.key, observation.durationMs]),
  );
