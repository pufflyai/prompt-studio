import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { ResourceBrowseEntry, WorkbenchCore } from "../../core";
import { listCommandParamEntries, mergeCommandParamArgs } from "./command-palette-params";
import type { CommandParamsRequest } from "./command-params-dialog";

export const singleResourceCommandParam = (request: CommandParamsRequest | null) => {
  const entries = listCommandParamEntries(request?.record.command.params);
  const entry = entries[0];
  return entries.length === 1 &&
    entry.type === "resource" &&
    typeof entry.resourceType === "string" &&
    entry.resourceType.length > 0 &&
    entry.required
    ? entry
    : undefined;
};

/** Use the declared provider's live data, preserving complete cross-owner references. */
export const queryCommandResources = async (
  workbench: WorkbenchCore,
  resourceType: string,
  query: string,
  limit: number,
  signal: AbortSignal,
) => {
  const groups = await workbench.commandPaletteResources.queryProviders({ resourceType, query, limit, signal });
  if (signal.aborted) return { resources: [], more: false };
  const resources = new Map<string, ResourceBrowseEntry>();
  for (const entry of workbench.resources.listResources(query))
    if (entry.resource.type === resourceType) resources.set(resourceKey(entry.resource), entry);
  for (const group of groups) {
    for (const item of group.results) {
      if (item.resource?.type !== resourceType) continue;
      const resource = { ...item.resource, label: item.label, icon: item.icon ?? item.resource.icon };
      resources.set(resourceKey(resource), {
        resource,
        indicator: item.indicator,
        description: item.description,
        group: item.group ?? group.title,
        searchText: `${query} ${item.label} ${(item.keywords ?? []).join(" ")}`,
      });
    }
  }
  return { resources: [...resources.values()], more: groups.some((group) => group.results.length >= limit) };
};

const runResourceParamCommand = async (
  workbench: WorkbenchCore,
  request: CommandParamsRequest,
  key: string,
  resource: ResourceRef,
) => {
  const commandId = request.record.command.id;
  const args = mergeCommandParamArgs(request.args, { [key]: resource }, request.record.command.params);
  const prepared = await workbench.commands.prepareCommandArgs(commandId, args, request.context);
  // Selecting a provider resource supplies an argument; its ordinary navigation target
  // must not replace the captured command's viewer or execution context.
  return workbench.commands.executeCommand(commandId, prepared, request.context);
};

/** The invoking parameter request owns one command at a time, including failed retries. */
export const createResourceParamCommand = (workbench: WorkbenchCore, request: CommandParamsRequest) => {
  let pending: Promise<unknown> | undefined;
  return {
    get pending() {
      return Boolean(pending);
    },
    run(key: string, resource: ResourceRef) {
      pending ??= runResourceParamCommand(workbench, request, key, resource).finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
};
