import { workbenchResourceKindDefinitions } from "@pstdio/sdk/extensions";
import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";
import { resolveCompositionResourceKindReferences } from "./composition-collection";

export { collectCompositionContributions } from "./composition-collection";

const addDiagnostic = (
  runtime: Accumulator,
  record: { extensionId: string; sourcePath: string; id: string },
  code: string,
  failedReference: string,
  message: string,
) => {
  runtime.diagnostics.push(
    createDiagnostic({
      code,
      message,
      extensionId: record.extensionId,
      sourcePath: record.sourcePath,
      metadata: { contributionId: record.id, failedReference },
    }),
  );
};

const validateResourceKindOwnership = (runtime: Accumulator) => {
  const reservedIds = new Set(Object.keys(workbenchResourceKindDefinitions));
  const owners = new Map<string, (typeof runtime.resourceKinds)[number]>();
  runtime.resourceKinds = runtime.resourceKinds.filter((kind) => {
    if (reservedIds.has(kind.id)) {
      addDiagnostic(
        runtime,
        kind,
        "extension_resource_kind_reserved",
        kind.id,
        `Resource kind "${kind.id}" is declared by the host`,
      );
      return false;
    }
    const owner = owners.get(kind.id);
    if (!owner) {
      owners.set(kind.id, kind);
      return true;
    }
    addDiagnostic(
      runtime,
      kind,
      "extension_resource_kind_duplicate",
      kind.id,
      `Resource kind "${kind.id}" is already declared by extension "${owner.name}"`,
    );
    return false;
  });
};

const validateResourceMenuOwnership = (runtime: Accumulator) => {
  const slots = new Map<string, { kind: (typeof runtime.resourceKinds)[number]; slot: { external?: boolean } }>();
  for (const kind of runtime.resourceKinds) {
    for (const [slotId, slot] of Object.entries(kind.contribution.menuSlots ?? {})) {
      slots.set(`${kind.id}.${slotId}`, { kind, slot });
    }
  }

  for (const command of runtime.commands) {
    command.menus = command.menus.filter((menu, index) => {
      const target = slots.get(menu.slot.id);
      if (!target || command.extensionId === target.kind.extensionId || target.slot.external) return true;

      addDiagnostic(
        runtime,
        { ...command, id: `${command.id}.menu.${index}` },
        "extension_resource_menu_slot_closed",
        menu.slot.id,
        `Menu slot "${menu.slot.id}" is closed to external commands`,
      );
      return false;
    });
  }
};

export const validateCompositionRelationships = (runtime: Accumulator) => {
  validateResourceKindOwnership(runtime);
  resolveCompositionResourceKindReferences(runtime);
  validateResourceMenuOwnership(runtime);

  for (const provider of runtime.resourceHierarchyProviders) {
    if (runtime.resourceKinds.some((kind) => kind.id === provider.resourceKindId)) continue;
    addDiagnostic(
      runtime,
      provider,
      "extension_resource_kind_missing",
      provider.resourceKindId,
      `Unknown resource kind "${provider.resourceKindId}"`,
    );
  }
};
