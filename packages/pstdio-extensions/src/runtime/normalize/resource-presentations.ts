import { workbenchResourceKindDefinitions } from "@pstdio/sdk/extensions";
import {
  commandRef,
  normalizedRef,
  refreshEventIds,
} from "../../workbench/metadata/workbench-extension-metadata-normalizers";
import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";

export const normalizeResourcePresentations = (runtime: Accumulator) => {
  const providers = runtime.extensions.flatMap((extension) =>
    (extension.definition.resourcePresentations ?? []).map((provider) => ({
      extensionId: extension.id,
      resourceKind: normalizedRef(provider.resourceKind, extension.id),
      resolveCommand: `${commandRef(provider.resolve, extension.id).extensionId}.command.${provider.resolve.id}`,
      refreshEvents: refreshEventIds(provider.refreshEvents, extension.id) ?? [],
    })),
  );
  const key = (provider: (typeof providers)[number]) =>
    JSON.stringify([provider.resourceKind.extensionId, provider.resourceKind.id]);
  runtime.resourcePresentations = providers.filter((provider) => {
    const kind = provider.resourceKind;
    const exists =
      kind.extensionId === "pstdio"
        ? Object.hasOwn(workbenchResourceKindDefinitions, kind.id)
        : runtime.resourceKinds.some((record) => record.extensionId === kind.extensionId && record.localId === kind.id);
    const command = runtime.commands.find((command) => command.id === provider.resolveCommand);
    const unique = providers.filter((candidate) => key(candidate) === key(provider)).length === 1;
    if (exists && unique && command?.extensionId === provider.extensionId) return true;
    runtime.diagnostics.push(
      createDiagnostic({
        code: "extension_resource_presentation_invalid",
        extensionId: provider.extensionId,
        message: unique
          ? "Resource presentation must reference a known kind and its own declared resolve command"
          : "Only one resource presentation provider may claim each resource kind",
      }),
    );
    return false;
  });
};
