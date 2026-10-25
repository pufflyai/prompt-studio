import { resolve } from "node:path";
import {
  completeBenchmarkWorker,
  completeFixturePreparation,
  contract,
  isFixturePreparationWorker,
  type PreparedFixtureIdentity,
  runFixturePreparation,
  runPreparedSample,
  type Workload,
} from "storage-scale-fixture";
import { prepareDatabaseFixture } from "./database-scale-fixture";

export const runDatabaseScaleEntrypoint = async (
  sample: (kind: Workload, count: number, root: string) => Promise<void>,
) => {
  const [kind, rows, path, phase, sourceOrChurn, churnOption] = process.argv.slice(2);
  const count = Number(rows);
  if (
    (kind !== "rich" && kind !== "small") ||
    !contract.scaling[kind].includes(count) ||
    !path ||
    !["prepare", "sample"].includes(phase)
  )
    throw new Error(
      "Use rich|small <frozen-count> <fresh-directory> prepare [churn] | sample <complete-fixture> [churn]",
    );
  const root = resolve(path);
  const churn = phase === "prepare" ? sourceOrChurn === "churn" : churnOption === "churn";
  const identity: PreparedFixtureIdentity = { format: "resource-documents-v1", kind, count, churn };
  const emit = (event: object) => console.log(JSON.stringify(event));
  if (phase === "prepare") {
    if (sourceOrChurn && sourceOrChurn !== "churn") throw new Error("Unknown preparation option");
    if (process.env.PSTDIO_SCALE_SUPERVISOR_PID === String(process.ppid))
      throw new Error("Fixture preparation must run outside a benchmark case");
    if (isFixturePreparationWorker())
      await completeFixturePreparation(() => prepareDatabaseFixture(kind, count, root, churn, emit));
    else await runFixturePreparation({ root, identity, command: process.execPath, args: process.argv.slice(1), emit });
    return;
  }
  if (!sourceOrChurn || (churnOption && churnOption !== "churn"))
    throw new Error("Pass a complete fixture and optional churn");
  if (process.env.PSTDIO_SCALE_SUPERVISOR_PID === String(process.ppid))
    await completeBenchmarkWorker(() => sample(kind, count, root));
  else {
    const result = await runPreparedSample({
      root,
      snapshot: resolve(sourceOrChurn),
      identity,
      name: `database-resource-documents-v1-${kind}-${count}-sample`,
      command: process.execPath,
      args: process.argv.slice(1),
      emit,
    });
    if (!result.complete) process.exitCode = 1;
  }
};
