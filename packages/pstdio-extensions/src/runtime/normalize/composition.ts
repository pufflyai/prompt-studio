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
    const owner = owners.get(`${kind.extensionId}:${kind.id}`);
    if (!owner) {
      owners.set(`${kind.extensionId}:${kind.id}`, kind);
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
  const slots = new Map<
    string,
    Array<{ kind: (typeof runtime.resourceKinds)[number]; slot: { external?: boolean } }>
  >();
  for (const kind of runtime.resourceKinds) {
    for (const [slotId, slot] of Object.entries(kind.contribution.menuSlots ?? {})) {
      const key = `${kind.id}.${slotId}`;
      slots.set(key, [...(slots.get(key) ?? []), { kind, slot }]);
      slots.set(`${kind.extensionId}.resource-kind.${key}`, [{ kind, slot }]);
    }
  }

  for (const command of runtime.commands) {
    command.menus = command.menus.flatMap((menu, index) => {
      const candidates = slots.get(menu.slot.id) ?? [];
      const owned = candidates.find((candidate) => candidate.kind.extensionId === command.extensionId);
      const target = owned ?? (candidates.length === 1 ? candidates[0] : undefined);
      if (!target && candidates.length > 1) {
        addDiagnostic(
          runtime,
          command,
          "extension_resource_menu_slot_ambiguous",
          menu.slot.id,
          "Resource menu slot needs an owner.",
        );
        return [];
      }
      if (!target) return [menu];
      if (command.extensionId === target.kind.extensionId || target.slot.external) {
        const prefix = `${target.kind.extensionId}.resource-kind.`;
        const id = menu.slot.id.startsWith(prefix) ? menu.slot.id : `${prefix}${menu.slot.id}`;
        return [{ ...menu, slot: { ...menu.slot, id } }];
      }

      addDiagnostic(
        runtime,
        { ...command, id: `${command.id}.menu.${index}` },
        "extension_resource_menu_slot_closed",
        menu.slot.id,
        `Menu slot "${menu.slot.id}" is closed to external commands`,
      );
      return [];
    });
  }
};

// A resolver defines the current reference of a resource, so only the kind's owner may provide it.
const validateResourceKindResolvers = (runtime: Accumulator) => {
  const commands = new Map(runtime.commands.map((command) => [command.id, command]));
  runtime.resourceKinds = runtime.resourceKinds.map((kind) => {
    const result = { ...kind };
    for (const key of ["resolveCommandId", "resolveManyCommandId"] as const) {
      const commandId = kind[key];
      if (!commandId || commands.get(commandId)?.extensionId === kind.extensionId) continue;
      addDiagnostic(
        runtime,
        kind,
        "extension_resource_kind_resolver_invalid",
        commandId,
        `Resource kind "${kind.id}" must resolve with a command of its own extension`,
      );
      delete result[key];
    }
    return result;
  });
};

export const validateCompositionRelationships = (runtime: Accumulator) => {
  validateResourceKindOwnership(runtime);
  resolveCompositionResourceKindReferences(runtime);
  validateResourceMenuOwnership(runtime);
  validateResourceKindResolvers(runtime);

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
