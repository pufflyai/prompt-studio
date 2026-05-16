import type { CommandRef } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeMiddlewareRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, refId } from "./accumulator";

export const registerMiddlewares = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, middleware] of Object.entries(source.definition.middlewares ?? {})) {
    if (!isRecord(middleware) || typeof middleware.handler !== "function") continue;

    const commandId = refId(middleware.command as CommandRef | string | undefined) ?? refId(middleware.commandId);
    if (!commandId) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_middleware_command",
          message: `Middleware "${ext.name}.${localId}" must reference a command`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const record: RuntimeMiddlewareRecord = {
      id: `${ext.name}.${localId}`,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      commandId,
      handler: middleware.handler as RuntimeMiddlewareRecord["handler"],
    };
    runtime.middlewares.push(record);
  }
};
