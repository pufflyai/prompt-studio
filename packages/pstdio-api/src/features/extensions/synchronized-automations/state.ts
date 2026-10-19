import {
  type AutomationDefinition,
  automationApplicationId,
  automationRecordSchema,
  fingerprint,
  type StoredRecord,
} from "pstdio-sync-contracts";
import { resolveWorkspaceExecutionTarget } from "../../workspaces/workspace-provider-execution-target";
import type { ExtensionsRouteDeps } from "../deps";
import { openPublishedCatalog, publicationSchema } from "../publication/catalog";
import { type AutomationDeps, openAutomationCatalog } from "./catalog";

const applyPendingDisables = (
  records: StoredRecord[],
  definitions: Map<string, AutomationDefinition>,
  shared: Set<string>,
) => {
  for (const record of records) {
    if (record.deleted) continue;
    const value = automationRecordSchema.parse(record.value);
    if (value.kind !== "definition") continue;
    shared.add(value.extensionId);
    const acceptedDefinition = definitions.get(value.scheduleId);
    // A pending edit can close admission locally, but cannot enable execution.
    if (acceptedDefinition && !value.enabled)
      definitions.set(value.scheduleId, { ...acceptedDefinition, enabled: false });
  }
};

const applyPublicationDisables = (records: StoredRecord[], disabled: Set<string>) => {
  for (const record of records) {
    if (!record.deleted && !publicationSchema.parse(record.value).enabled) disabled.add(record.recordId);
  }
};

export const loadAutomationState = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const catalog = await openAutomationCatalog(deps, projectId);
  const { accepted, working } = await catalog.readState();
  const publications = await (await openPublishedCatalog(deps, projectId)).readState();
  const shared = new Set<string>();
  const disabledExtensions = new Set<string>();
  for (const record of Object.values(publications.accepted?.records ?? {})) {
    if (record.deleted) continue;
    const publication = publicationSchema.parse(record.value);
    if (publication.automation) shared.add(publication.extensionId);
    if (!publication.enabled) disabledExtensions.add(publication.extensionId);
  }
  const definitions = new Map<string, AutomationDefinition>();
  for (const record of Object.values(accepted?.records ?? {})) {
    if (record.deleted) continue;
    const value = automationRecordSchema.parse(record.value);
    if (value.kind !== "definition") continue;
    if (value.target.workbenchId !== projectId) throw new Error("Automation target workbench mismatch");
    definitions.set(value.scheduleId, value);
    shared.add(value.extensionId);
  }
  applyPublicationDisables(Object.values(publications.working ?? {}), disabledExtensions);
  applyPendingDisables(Object.values(working ?? {}), definitions, shared);
  return { catalog, definitions, shared, disabledExtensions };
};

export const acknowledgeAutomations = async (
  deps: AutomationDeps,
  state: Awaited<ReturnType<typeof loadAutomationState>>,
) => {
  if (!state.definitions.size) return;
  const { environmentId } = await deps.environmentService.get();
  for (const definition of state.definitions.values()) {
    if (definition.target.environmentId !== environmentId) continue;
    const recordId = automationApplicationId(definition.scheduleId);
    const record = await state.catalog.records.read(recordId);
    const hash = await fingerprint({
      definition,
      sharedEnabled: !state.disabledExtensions.has(definition.extensionId),
    });
    const previous = record.exists && !record.deleted ? automationRecordSchema.parse(record.value) : null;
    if (previous?.kind === "application" && previous.definition === hash) continue;
    await state.catalog.records.commit({
      operationId: crypto.randomUUID(),
      edits: [
        {
          recordId,
          expectedRevision: record.revision,
          replace: { kind: "application", scheduleId: definition.scheduleId, environmentId, definition: hash },
        },
      ],
    });
  }
};

export const canRunAutomation = async (deps: AutomationDeps, projectId: string, definition: AutomationDefinition) => {
  if (!definition.enabled || definition.target.workbenchId !== projectId) return false;
  if ((await deps.environmentService.get()).environmentId !== definition.target.environmentId) return false;
  const target = await resolveWorkspaceExecutionTarget(deps, definition.target.workspaceId);
  return target?.workspace.project_id === projectId && !target.workspace.archived;
};
