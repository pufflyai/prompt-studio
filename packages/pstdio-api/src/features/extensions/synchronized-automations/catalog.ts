import {
  automationApplicationId,
  automationDefinitionId,
  automationDefinitionSchema,
  automationRecordSchema,
  automationsId,
  fingerprint,
} from "pstdio-sync-contracts";
import type { RouteDeps } from "../../deps";
import { resolveWorkspaceExecutionTarget } from "../../workspaces/workspace-provider-execution-target";
import type { ExtensionsRouteDeps } from "../deps";
import { openPublishedCatalog, publicationSchema } from "../publication/catalog";

export type AutomationDeps = ExtensionsRouteDeps & Pick<RouteDeps, "environmentService">;

export const automationOwner = (workbenchId: string) => ({ workbenchId, extensionId: automationsId });
export const openAutomationCatalog = (deps: ExtensionsRouteDeps, workbenchId: string) =>
  deps.extensionStorageService.open({ owner: automationOwner(workbenchId) });

export const assignAutomation = async (
  deps: AutomationDeps,
  projectId: string,
  input: { scheduleId: string; workspaceId: string },
  now = new Date(),
) => {
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const schedule = snapshot.runtime.schedules.find((entry) => entry.id === input.scheduleId);
  if (!schedule) throw new Error("Schedule not found");
  const resolved = await resolveWorkspaceExecutionTarget(deps, input.workspaceId);
  const workspace = resolved?.workspace;
  if (!workspace || workspace.project_id !== projectId || workspace.archived)
    throw new Error("Choose an existing local workspace in this workbench");
  if (schedule.workspaceId && schedule.workspaceId !== workspace.id)
    throw new Error("Choose the workspace required by this schedule");
  const catalog = await openAutomationCatalog(deps, projectId);
  const recordId = automationDefinitionId(schedule.id);
  const record = await catalog.records.read(recordId);
  if (record.exists) throw new Error("Automation already has a target; retargeting is unavailable");
  const { environmentId } = await deps.environmentService.get();
  return catalog.records.commit({
    operationId: crypto.randomUUID(),
    edits: [
      {
        recordId,
        expectedRevision: record.revision,
        replace: {
          kind: "definition",
          scheduleId: schedule.id,
          extensionId: schedule.extensionId,
          target: { environmentId, workbenchId: projectId, workspaceId: workspace.id },
          enabled: !schedule.disabled,
          startsAt: now.toISOString(),
        },
      },
    ],
  });
};

export const setAutomationEnabled = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  scheduleId: string,
  expectedRevision: string,
  enabled: boolean,
) => {
  const catalog = await openAutomationCatalog(deps, projectId);
  const recordId = automationDefinitionId(scheduleId);
  const record = await catalog.records.read(recordId);
  if (record.revision !== expectedRevision) throw new Error("Automation changed; read its revision again");
  const value = automationDefinitionSchema.parse(record.value);
  return catalog.records.commit({
    operationId: crypto.randomUUID(),
    edits: [
      {
        recordId,
        expectedRevision,
        replace: { ...value, enabled },
      },
    ],
  });
};

export const listAutomations = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const catalog = await openAutomationCatalog(deps, projectId);
  const accepted = (await catalog.readState()).accepted;
  const publications = new Map(
    (await (await openPublishedCatalog(deps, projectId)).records.list()).map((record) => [record.recordId, record]),
  );
  return Promise.all(
    (await catalog.records.list())
      .filter((record) => record.exists && !record.deleted)
      .flatMap((record) => {
        const definition = automationRecordSchema.parse(record.value);
        if (definition.kind !== "definition") return [];
        return [
          (async () => {
            const publication = publications.get(definition.extensionId);
            const sharedEnabled =
              !publication || (!publication.deleted && publicationSchema.parse(publication.value).enabled);
            const applied = accepted?.records[automationApplicationId(definition.scheduleId)];
            const application = applied && !applied.deleted ? automationRecordSchema.parse(applied.value) : null;
            const desired = await fingerprint({ definition, sharedEnabled });
            return {
              revision: record.revision,
              ...definition,
              delivery:
                application?.kind === "application" &&
                application.environmentId === definition.target.environmentId &&
                application.definition === desired
                  ? "applied"
                  : "pending",
            };
          })(),
        ];
      }),
  );
};
