import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";

const EXTENSION_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;
const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*$/;

export const validateIdentity = (source: LoadedExtensionSource, runtime: Accumulator) => {
  const { id, namespace, name } = source.definition;

  if (typeof id !== "string" || !EXTENSION_ID_PATTERN.test(id)) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "invalid_extension_id",
        message: `Extension id must match ${EXTENSION_ID_PATTERN}`,
        sourcePath: source.sourcePath,
        extensionId: typeof id === "string" ? id : undefined,
      }),
    );
    return false;
  }

  if (typeof namespace !== "string" || !NAMESPACE_PATTERN.test(namespace)) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "invalid_namespace",
        message: `Extension namespace must match ${NAMESPACE_PATTERN}`,
        sourcePath: source.sourcePath,
        extensionId: id,
      }),
    );
    return false;
  }

  if (typeof name !== "string" || name.length === 0) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "missing_display_name",
        message: "Extension definition must include a display name",
        sourcePath: source.sourcePath,
        extensionId: id,
      }),
    );
    return false;
  }

  return true;
};

export const registerExtension = (
  source: LoadedExtensionSource,
  runtime: Accumulator,
  extensionsById: Map<string, NormalizedExtension>,
  namespacesInUse: Map<string, NormalizedExtension>,
) => {
  const { id, namespace, name, version, description } = source.definition;

  const normalized: NormalizedExtension = {
    id,
    namespace,
    displayName: name,
    version,
    description,
    sourcePath: source.sourcePath,
    sourceKind: source.sourceKind,
    definition: source.definition,
  };

  const existingById = extensionsById.get(id);
  if (existingById) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "duplicate_extension_id",
        message: `Extension id "${id}" is already provided by ${existingById.sourcePath}`,
        extensionId: id,
        sourcePath: source.sourcePath,
      }),
    );
  } else {
    extensionsById.set(id, normalized);
  }

  const existingByNs = namespacesInUse.get(namespace);
  if (existingByNs && existingByNs.id !== id) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "duplicate_namespace",
        message: `Namespace "${namespace}" is already used by ${existingByNs.id}`,
        extensionId: id,
        sourcePath: source.sourcePath,
      }),
    );
  } else {
    namespacesInUse.set(namespace, normalized);
  }

  runtime.extensions.push(normalized);
  return normalized;
};
