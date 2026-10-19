import type { CommandInvocation } from "@pstdio/sdk/extensions";
import type { RuntimeCommandRecord } from "../../types/runtime";
import type { RunnerState } from "./context";
import type { CommandRunnerEnvironment } from "./types";

export const storagePreflight = async (
  state: RunnerState,
  projectId: string,
  record: RuntimeCommandRecord,
  env: CommandRunnerEnvironment,
  invocation: CommandInvocation,
) => {
  if (!record.storageInputs) return;
  try {
    await state.deps.beforeDispatch?.({
      projectId,
      extensionId: record.extensionId,
      recordIds: record.storageInputs(invocation.params, { id: env.storage.records.id }),
    });
  } catch (error) {
    return {
      ok: false as const,
      status: "rejected" as const,
      code: "storage_conflict",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};
