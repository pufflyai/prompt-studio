import type { NormalizedExtension, RuntimePrivateHandlerRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator, RegistryIndex } from "./accumulator";

export const privateHandlerId = (
  rendererId: string,
  rendererKind: RuntimePrivateHandlerRecord["rendererKind"],
  operation: string,
) => `${rendererId}.${rendererKind}.${operation}`;

export const registerPrivateHandler = (input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  index: RegistryIndex;
  rendererId: string;
  rendererKind: RuntimePrivateHandlerRecord["rendererKind"];
  rendererLocalId: string;
  operation: string;
  handler: unknown;
}): string | undefined => {
  if (typeof input.handler !== "function") return undefined;

  const id = privateHandlerId(input.rendererId, input.rendererKind, input.operation);
  const existing = input.index.privateHandlerIds.get(id) ?? input.index.commandIds.get(id);
  if (existing) {
    input.runtime.diagnostics.push(
      createDiagnostic({
        code: "duplicate_private_handler_id",
        message: `Private handler id "${id}" is already provided by ${existing.sourcePath}`,
        extensionId: input.ext.id,
        sourcePath: input.source.sourcePath,
        metadata: { rendererId: input.rendererId, rendererKind: input.rendererKind, operation: input.operation },
      }),
    );
    return undefined;
  }

  const record: RuntimePrivateHandlerRecord = {
    id,
    localId: `${input.rendererLocalId}.${input.operation}`,
    extensionId: input.ext.id,
    name: input.ext.name,
    sourcePath: input.source.sourcePath,
    rendererId: input.rendererId,
    rendererKind: input.rendererKind,
    operation: input.operation,
    handler: input.handler as RuntimePrivateHandlerRecord["handler"],
  };

  input.index.privateHandlerIds.set(id, record);
  input.runtime.privateHandlers.push(record);
  return id;
};
