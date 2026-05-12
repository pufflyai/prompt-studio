import type { EventRef } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeHookRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, refId } from "./accumulator";

export const registerHooks = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, hook] of Object.entries(source.definition.hooks ?? {})) {
    if (!isRecord(hook) || typeof hook.handler !== "function") continue;

    const eventId = refId(hook.event as EventRef | string | undefined) ?? refId(hook.eventId);
    if (!eventId) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_hook_event",
          message: `Hook "${ext.name}.${localId}" must reference an event`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const record: RuntimeHookRecord = {
      id: `${ext.name}.${localId}`,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      eventId,
      handler: hook.handler as RuntimeHookRecord["handler"],
    };
    runtime.hooks.push(record);
  }
};
