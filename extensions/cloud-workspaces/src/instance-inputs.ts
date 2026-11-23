import { join } from "node:path";

const limitKeys = [
  "stagedInputBytes",
  "inputFiles",
  "inputFileBytes",
  "inFlightTransfers",
  "finalizationSeconds",
  "unreferencedInputRetentionSeconds",
  "deadlineSeconds",
  "exportBytes",
  "exportFiles",
  "exportRetentionSeconds",
];

function validatedWorkloadLimits(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Template limits are required.");
  const limits = value as Record<string, number>;
  for (const key of limitKeys) {
    const limit = limits[key];
    if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit <= 0)
      throw new Error(`Template limits.${key} must be a finite positive integer.`);
  }
  return limits;
}

// One instance serves every template published to it, so each limit must fit the largest template.
export function instanceLimits(manifests: unknown[]) {
  const limits = manifests.flatMap((manifest) => {
    const current = manifest as { apiVersion?: string; spec?: { limits?: unknown } };
    return current.apiVersion === "pocketcoder.dev/v1" ? [validatedWorkloadLimits(current.spec?.limits)] : [];
  });
  if (limits.length === 0) return undefined;
  return Object.fromEntries(limitKeys.map((key) => [key, Math.max(...limits.map((limit) => limit[key] as number))]));
}

export function inputEnvironment(root: string, limits: Record<string, number>) {
  const capacity = { bytes: limits.stagedInputBytes, files: limits.inputFiles };
  return {
    POCKETCODER_WORKLOAD_LIMITS: JSON.stringify(limits),
    POCKETCODER_INPUT_DIR: join(root, "launch"),
    POCKETCODER_INPUT_STORAGE: JSON.stringify({
      root: join(root, "inputs"),
      projection: {
        root: join(root, "projection"),
        probeImage: "oven/bun@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895",
        capacity,
      },
      limits: {
        fileBytes: limits.inputFileBytes,
        stagedBytes: limits.stagedInputBytes,
        files: limits.inputFiles,
        transfers: limits.inFlightTransfers,
        transferMs: limits.finalizationSeconds * 1000,
        retentionMs: limits.unreferencedInputRetentionSeconds * 1000,
      },
      principal: capacity,
      instance: capacity,
      headroom: { bytes: limits.inputFileBytes, files: limits.inputFiles },
    }),
  };
}
