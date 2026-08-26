import type { MiddlewareDefinition } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeMiddlewareRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { resolveCommandRef } from "./references";

export const registerMiddlewares = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "middleware",
    contributions: contributionArray<MiddlewareDefinition>(source.definition.middlewares),
  });
  for (const middleware of contributions) {
    const localId = middleware.id;
    if (
      !isRecord(middleware.command) ||
      middleware.command.kind !== "command" ||
      typeof middleware.run !== "function"
    ) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_middleware_command",
          message: `Middleware "${localId}" must define a typed command reference and run callback`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    const commandId = resolveCommandRef(ext, middleware.command);

    const record: RuntimeMiddlewareRecord = {
      ...contributionRecordBase(ext, source, "middleware", localId),
      commandId,
      handler: middleware.run as RuntimeMiddlewareRecord["handler"],
    };
    runtime.middlewares.push(record);
  }
};
