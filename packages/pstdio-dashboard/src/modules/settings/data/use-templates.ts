import { getCommandValue } from "@pstdio/sdk/extensions";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import {
  deleteProjectTemplate,
  getProjectTemplate,
  type ProjectTemplateAsset,
  projectTemplateAssetsQueryKey,
  saveProjectTemplate,
  type TemplateContent,
} from "./template-provider-api";

const saveDomain = "settings.template-save";
const deleteDomain = "settings.template-delete";
const templateQueryKey = (template: ProjectTemplateAsset, scopeKey: string) =>
  ["project-template", scopeKey, template.projectId, template.id] as const;
const templateSubject = (template: ProjectTemplateAsset) =>
  operationSubject("template", template.projectId, template.id);

export const getTemplateOperations = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const client = getDashboardQueryClient(owner);
  const execute = getRuntimeApiClient(owner).extensions.execute;
  const scopeKey = () => {
    const { runtimeId, accountId, accountOrigin } = queries.getScope();
    return JSON.stringify([runtimeId, accountOrigin, accountId]);
  };
  const runner =
    (signal: AbortSignal) =>
    async <T>(projectId: string, commandId: string, params: Record<string, unknown>) => {
      const response = await execute(commandId, { projectId, params, source: "dashboard" }, { signal });
      return getCommandValue(response.outcome) as T;
    };
  const active = (template: ProjectTemplateAsset) =>
    operations.getSnapshot().pending.find((entry) => entry.subjects.includes(templateSubject(template)));
  const read = (template: ProjectTemplateAsset, signal: AbortSignal) => getProjectTemplate(template, runner(signal));
  const assertAuthority = (expected: string) => {
    if (scopeKey() !== expected) throw new Error("This template belongs to a closed account.");
  };
  const sourceCommand = (template: ProjectTemplateAsset) => ({
    id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
    args: { panelId: "templates", itemId: template.id },
  });
  const accept = async (
    template: ProjectTemplateAsset,
    scope: string,
    value: TemplateContent | null,
    signal: AbortSignal,
  ) => {
    const queryKey = templateQueryKey(template, scope);
    await client.cancelQueries({ queryKey, exact: true });
    signal.throwIfAborted();
    client.setQueryData(queryKey, value);
  };
  return {
    scopeKey,
    read,
    active,
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    async save(template: ProjectTemplateAsset, content: string, expectedScope: string) {
      assertAuthority(expectedScope);
      if (active(template)) throw new Error("This template has an unfinished change. Check System activity.");
      return operations.submit<TemplateContent>({
        domain: saveDomain,
        projectId: template.projectId,
        subjects: [templateSubject(template)],
        title: `Save ${template.title}`,
        sourceCommand: sourceCommand(template),
        draft: content,
        intent: content,
        classify: classifyApiWrite,
        async write(signal) {
          assertAuthority(expectedScope);
          const saved = await saveProjectTemplate(template, content, runner(signal));
          if (!saved || saved.name !== template.name || saved.type !== template.localType)
            throw new SyntaxError("The saved template could not be confirmed.");
          return saved;
        },
        reconcile: (saved, signal) => accept(template, expectedScope, saved, signal),
        async check(signal) {
          const saved = await read(template, signal);
          return saved?.name === template.name && saved.type === template.localType && saved.content === content
            ? { status: "confirmed", result: saved }
            : { status: "unknown" };
        },
      }).result;
    },
    async remove(template: ProjectTemplateAsset, draft: string | undefined, expectedScope: string) {
      assertAuthority(expectedScope);
      if (active(template)) throw new Error("This template has an unfinished change. Check System activity.");
      return operations.submit<void>({
        domain: deleteDomain,
        projectId: template.projectId,
        subjects: [templateSubject(template)],
        title: `Delete ${template.title}`,
        sourceCommand: sourceCommand(template),
        draft,
        releaseOnDiscard: true,
        classify: classifyApiWrite,
        async write(signal) {
          assertAuthority(expectedScope);
          await deleteProjectTemplate(template, runner(signal));
        },
        async reconcile(_result, signal) {
          if ((await read(template, signal)) !== null) throw new Error("The template is still available.");
          await accept(template, expectedScope, null, signal);
          void client.invalidateQueries({ queryKey: projectTemplateAssetsQueryKey(template.projectId), exact: true });
        },
      }).result;
    },
  };
});

export const useTemplateEditor = (template: ProjectTemplateAsset) => {
  const templates = getTemplateOperations();
  useSyncExternalStore(templates.subscribe, templates.snapshot, templates.snapshot);
  const scope = templates.scopeKey();
  const pending = templates.active(template);
  const result = useQuery({
    queryKey: templateQueryKey(template, scope),
    queryFn: ({ signal }) => templates.read(template, signal),
  });
  return {
    ...result,
    pending,
    deleting: pending?.domain === deleteDomain,
    scope,
    save: (content: string) => templates.save(template, content, scope),
    remove: (draft: string | undefined) => templates.remove(template, draft, scope),
  };
};
