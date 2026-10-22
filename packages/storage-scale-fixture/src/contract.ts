import type { Workload } from "./fixture";

export const contract = {
  samples: 10,
  ceilingMs: 1_000,
  caseTimeoutMs: 60_000,
  atomicRows: 100,
  // Offered workload is fixed, even if the receiver falls behind.
  incoming: { durationMs: 10_000, intervalMs: 100, operations: 100 },
  scaling: { rich: [1_000, 10_000], small: [1_000, 10_000, 100_000] },
  profiles: {
    native: { rendererRate: 1, runtimeCpus: null },
    renderer: { rendererRate: 4, runtimeCpus: null },
    runtime: { rendererRate: 1, runtimeCpus: 0.5 },
    combined: { rendererRate: 4, runtimeCpus: 0.5 },
  },
  backgrounds: ["idle", "noop-sync", "incoming", "fold", "other-owner-catchup"] as const,
  views: ["board", "list", "second-page", "point", "aggregate", "all-owner-burst"] as const,
  edits: ["short", "indexed", "tag", "nested", "insert", "delete", "direct-sdk-first-write"] as const,
};
export type Profile = keyof typeof contract.profiles;
export type Background = (typeof contract.backgrounds)[number];

export const scenarios = (kind: Workload) => {
  const operations: string[] = [...contract.views, ...contract.edits];
  operations.push("all-owner-edit-burst");
  if (kind === "rich") operations.push("multiline");
  return Object.keys(contract.profiles).flatMap((profile) =>
    contract.backgrounds.flatMap((background) =>
      ["cold", "warm"].flatMap((temperature) =>
        operations.flatMap((operation) =>
          Array.from({ length: contract.samples }, (_, sample) => ({
            profile: profile as Profile,
            background,
            temperature,
            operation,
            sample,
          })),
        ),
      ),
    ),
  );
};
