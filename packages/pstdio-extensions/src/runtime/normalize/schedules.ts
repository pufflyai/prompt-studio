import type { ScheduleContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeScheduleRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";
import { resolveCommandRef } from "./references";

export const registerSchedules = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "schedule",
    contributions: contributionArray<ScheduleContribution>(source.definition.schedules),
  });
  for (const schedule of contributions) {
    const localId = schedule.id;
    if (
      typeof schedule.schedule !== "string" ||
      !isLocalizableString(schedule.title) ||
      !isRecord(schedule.command) ||
      schedule.command.kind !== "command"
    ) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_schedule_command",
          message: `Schedule "${localId}" must define title, schedule, and a typed command reference`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    const commandId = resolveCommandRef(ext, schedule.command);

    const record: RuntimeScheduleRecord = {
      ...contributionRecordBase(ext, source, "schedule", localId),
      title: schedule.title,
      cron: schedule.schedule,
      commandId,
      params: schedule.params,
      repoId: schedule.repo?.id,
      disabled: typeof schedule.disabled === "boolean" ? schedule.disabled : undefined,
    };
    runtime.schedules.push(record);
  }
};
