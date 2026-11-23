import { getCommandValue } from "@pstdio/sdk/extensions";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import {
  deleteProjectTemplate,
  getProjectTemplate,
  type ProjectTemplateAsset,
  saveProjectTemplate,
  type TemplateContent,
} from "./template-provider-api";

const domain = "settings.template-save";
const templateQueryKey = (template: ProjectTemplateAsset, scopeKey: string) =>
  ["project-template", scopeKey, template.projectId, template.id] as const;
const templateSubject = (template: ProjectTemplateAsset) =>
  operationSubject("template", template.projectId, template.id);

export const getTemplateSaves = createRuntimeState((owner) => {
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
    operations
      .getSnapshot()
      .pending.find((entry) => entry.domain === domain && entry.subjects.includes(templateSubject(template)));
  const read = (template: ProjectTemplateAsset, signal: AbortSignal) => getProjectTemplate(template, runner(signal));
  return {
    scopeKey,
    read,
    active,
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    async save(template: ProjectTemplateAsset, content: string, expectedScope: string) {
      const assertAuthority = () => {
        if (scopeKey() !== expectedScope) throw new Error("This template belongs to a closed account.");
      };
      assertAuthority();
      if (active(template)) throw new Error("This template has an unfinished save. Check System activity.");
      return operations.submit<TemplateContent>({
        domain,
        projectId: template.projectId,
        subjects: [templateSubject(template)],
        title: `Save ${template.title}`,
        sourceCommand: { id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID, args: { panelId: "templates", itemId: template.id } },
        draft: content,
        intent: content,
        classify: classifyApiWrite,
        async write(signal) {
          assertAuthority();
          const saved = await saveProjectTemplate(template, content, runner(signal));
          if (!saved || saved.name !== template.name || saved.type !== template.localType)
            throw new SyntaxError("The saved template could not be confirmed.");
          return saved;
        },
        async reconcile(saved, signal) {
          const queryKey = templateQueryKey(template, expectedScope);
          await client.cancelQueries({ queryKey, exact: true });
          signal.throwIfAborted();
          client.setQueryData(queryKey, saved);
        },
        async check(signal) {
          const saved = await read(template, signal);
          return saved?.name === template.name && saved.type === template.localType && saved.content === content
            ? { status: "confirmed", result: saved }
            : { status: "unknown" };
        },
      }).result;
    },
  };
});

export const useTemplateEditor = (template: ProjectTemplateAsset) => {
  const saves = getTemplateSaves();
  useSyncExternalStore(saves.subscribe, saves.snapshot, saves.snapshot);
  const scope = saves.scopeKey();
  const pending = saves.active(template);
  const result = useQuery({
    queryKey: templateQueryKey(template, scope),
    queryFn: ({ signal }) => saves.read(template, signal),
  });
  return { ...result, pending, scope, save: (content: string) => saves.save(template, content, scope) };
};

export const useDeleteProjectTemplate = () =>
  useMutation({
    mutationFn: deleteProjectTemplate,
  });
