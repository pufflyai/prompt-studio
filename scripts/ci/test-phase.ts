import type { SourceIdentity } from "./test-plan";

export interface TestPhase {
  kind: string;
  id: string;
  source: SourceIdentity;
  planDigest: string;
  executionId: string;
  job: string | null;
  host: string;
  startedAt: string;
  elapsedMs: number;
  outcome: string;
  complete: boolean;
  cacheOutcome: "unknown" | "prebuilt";
}
export const testPhase = (
  identity: Pick<TestPhase, "source" | "planDigest" | "executionId" | "job">,
  values: Pick<TestPhase, "kind" | "id" | "elapsedMs" | "outcome"> & {
    startedAt?: string;
    cacheOutcome?: TestPhase["cacheOutcome"];
  },
) => ({
  ...identity,
  ...values,
  host: `${process.platform}/${process.arch}`,
  startedAt: values.startedAt ?? new Date(Date.now() - values.elapsedMs).toISOString(),
  complete: !["cancelled", "incomplete", "not-run"].includes(values.outcome),
  cacheOutcome: values.cacheOutcome ?? "unknown",
});
