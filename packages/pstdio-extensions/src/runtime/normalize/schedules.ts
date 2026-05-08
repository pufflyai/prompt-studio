import type { CommandRef } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeScheduleRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, refId } from "./accumulator";

export const registerSchedules = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, schedule] of Object.entries(source.definition.schedules ?? {})) {
    if (!isRecord(schedule) || typeof schedule.cron !== "string" || typeof schedule.title !== "string") continue;

    const commandId = refId(schedule.command as CommandRef | string | undefined) ?? refId(schedule.commandId);
    if (!commandId) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_schedule_command",
          message: `Schedule "${ext.namespace}.${localId}" must reference a command`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const record: RuntimeScheduleRecord = {
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      title: schedule.title,
      cron: schedule.cron,
      commandId,
      params: schedule.params,
      repoId: typeof schedule.repoId === "string" ? schedule.repoId : undefined,
      disabled: typeof schedule.disabled === "boolean" ? schedule.disabled : undefined,
    };
    runtime.schedules.push(record);
  }
};
