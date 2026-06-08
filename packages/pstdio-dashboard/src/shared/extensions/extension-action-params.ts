import type { ExtensionCommandRecord, ExtensionMenuContribution } from "@pstdio/sdk/api";
import type { ActionDescriptor, ActionParamDescriptor, ActionParamValue } from "./action-types";
import { resolveLabel } from "./localized-label";
import type { ExtensionResourceContext } from "./types";

type ExtensionParamDescriptor = NonNullable<ExtensionCommandRecord["params"]>[string];

export type ExtensionActionDescriptor = ActionDescriptor & {
  commandId: string;
  slotId: string;
  baseParams: Record<string, unknown>;
  contributionParams: Record<string, unknown>;
};

const readString = (value: unknown) => (typeof value === "string" ? value : undefined);

const readBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);

const readDefaultValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
};

const labelFromKey = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildBaseDescriptor = (key: string, param: ExtensionParamDescriptor) => ({
  key,
  label: readString(param.label) ?? labelFromKey(key),
  description: readString(param.description),
  required: readBoolean(param.required),
  defaultValue: readDefaultValue(param.defaultValue),
});

const readOptions = (options: unknown) => {
  if (!Array.isArray(options)) return undefined;

  return options
    .map((option) => {
      if (!option || typeof option !== "object") return null;
      const record = option as Record<string, unknown>;
      const value = readString(record.value);
      const label = readString(record.label);
      return value && label ? { value, label } : null;
    })
    .filter((option): option is { value: string; label: string } => Boolean(option));
};

const mapActionParamDescriptor = (key: string, param: ExtensionParamDescriptor): ActionParamDescriptor | null => {
  const base = buildBaseDescriptor(key, param);

  if (param.type === "text" || param.type === "longtext") {
    return { ...base, type: param.type };
  }

  if (param.type === "select") {
    return { ...base, type: "select", options: readOptions(param.options) };
  }

  if (param.type === "template") {
    return { ...base, type: "template-select", templateType: readString(param.templateType) };
  }

  if (param.type === "harness") {
    return { ...base, type: "agent" };
  }

  if (param.type === "repo") {
    return { ...base, type: "repo" };
  }

  return null;
};

const readMetadataString = (resource: ExtensionResourceContext | undefined, key: string) => {
  const value = resource?.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const getTicketContextParamValue = (key: string, resource: ExtensionResourceContext) => {
  if (key === "ticket" || key === "ticketShorthand") {
    return (
      readMetadataString(resource, "shorthand") ??
      readMetadataString(resource, "ticket") ??
      readMetadataString(resource, "ticketShorthand") ??
      (resource.type === "ticket" ? resource.label : undefined)
    );
  }

  if (key === "ticketId") {
    return readMetadataString(resource, "ticketId") ?? (resource.type === "ticket" ? resource.id : undefined);
  }

  if (key === "rowId" && resource.type === "ticket") {
    return resource.id;
  }

  return undefined;
};

const getWorkspaceContextParamValue = (key: string, resource: ExtensionResourceContext) => {
  if (key === "workspaceId" && resource.type === "workspace") {
    return resource.id;
  }

  if (key === "workspace" || key === "workspaceShorthand") {
    return (
      readMetadataString(resource, "workspaceShorthand") ?? (resource.type === "workspace" ? resource.label : undefined)
    );
  }

  return undefined;
};

const getSessionContextParamValue = (key: string, resource: ExtensionResourceContext) => {
  if (key === "sessionId" && resource.type === "session") {
    return resource.id;
  }

  return undefined;
};

const getContextParamValue = (key: string, resource: ExtensionResourceContext | undefined) => {
  if (!resource) return undefined;

  return (
    getTicketContextParamValue(key, resource) ??
    getWorkspaceContextParamValue(key, resource) ??
    getSessionContextParamValue(key, resource)
  );
};

export const buildExtensionActionDescriptor = (input: {
  contribution: ExtensionMenuContribution;
  command: ExtensionCommandRecord | undefined;
  resource?: ExtensionResourceContext;
}) => {
  const { contribution, command, resource } = input;
  const contributionParams = contribution.params ?? {};
  const baseParams: Record<string, unknown> = {};
  const params: ActionParamDescriptor[] = [];

  for (const [key, param] of Object.entries(command?.params ?? {})) {
    if (Object.hasOwn(contributionParams, key)) continue;

    const contextValue = getContextParamValue(key, resource);
    if (contextValue !== undefined) {
      baseParams[key] = contextValue;
      continue;
    }

    const actionParam = mapActionParamDescriptor(key, param);
    if (actionParam) {
      params.push(actionParam);
    }
  }

  return {
    key: `extension:${contribution.id}`,
    label: resolveLabel(contribution.label),
    targetType: "extension",
    placement: contribution.slotId,
    icon: contribution.icon,
    presentation: contribution.presentation,
    commandId: contribution.commandId,
    slotId: contribution.slotId,
    params,
    baseParams,
    contributionParams,
  } satisfies ExtensionActionDescriptor;
};

export const mapExtensionActionParams = (params: Record<string, ActionParamValue>) => {
  const mappedParams: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      mappedParams[key] = value;
      continue;
    }

    if (typeof value.agent === "string") {
      if (!value.agent) continue;
      mappedParams[key] = { harnessId: value.agent, ...(value.model ? { model: value.model } : {}) };
      continue;
    }

    if (typeof value.repo === "string") {
      if (!value.repo) continue;
      mappedParams[key] = { repoId: value.repo, ...(value.branch ? { branch: value.branch } : {}) };
      continue;
    }

    mappedParams[key] = value;
  }

  return mappedParams;
};
