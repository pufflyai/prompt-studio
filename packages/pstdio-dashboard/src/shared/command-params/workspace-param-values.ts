import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import {
  buildCommandParamInitialValues,
  type CommandParamFieldProps,
  type CommandParamValue,
  normalizeCommandParamValues,
} from "@pstdio/workbench/react";
import { workspaceProviderParamSchema } from "@/shared/workspaces/workspace-provider-param-schema";
import { parseParamRecord, serializeParamRecord } from "./param-field-shared";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readWorkspace = (value: CommandParamValue) => {
  const record = parseParamRecord(value);
  return {
    providerId: typeof record.providerId === "string" ? record.providerId : "",
    params: isRecord(record.params) ? record.params : {},
  };
};

// Partial input must survive until the containing form validates required fields.
export const serializeWorkspace = (
  provider: WorkspaceProviderDescriptor,
  values: Record<string, CommandParamValue>,
) => {
  const schema = Object.fromEntries(
    Object.entries(workspaceProviderParamSchema(provider)).map(([key, param]) => [key, { ...param, required: false }]),
  );
  return serializeParamRecord({ providerId: provider.id, params: normalizeCommandParamValues(schema, values) });
};

export const defaultWorkspaceValues = (provider: WorkspaceProviderDescriptor) =>
  buildCommandParamInitialValues(workspaceProviderParamSchema(provider));

// Defaults apply when a provider is chosen, so a later clear stays cleared.
export const storedWorkspaceValues = (provider: WorkspaceProviderDescriptor, params: Record<string, unknown>) =>
  buildCommandParamInitialValues(
    Object.fromEntries(
      Object.entries(workspaceProviderParamSchema(provider)).map(([key, { defaultValue: _, ...param }]) => [
        key,
        param,
      ]),
    ),
    params,
  );

interface WorkspaceValueChange extends Pick<CommandParamFieldProps, "value" | "onChange" | "onUpdateValue"> {
  provider: WorkspaceProviderDescriptor;
}

export const changeWorkspaceParamValue = (input: WorkspaceValueChange, key: string, nextValue: CommandParamValue) => {
  const { provider, value, onChange, onUpdateValue } = input;
  const update = (currentValue: CommandParamValue) => {
    const current = readWorkspace(currentValue);
    if (current.providerId !== provider.id) return currentValue;
    try {
      const values = storedWorkspaceValues(provider, current.params);
      return serializeWorkspace(provider, { ...values, [key]: nextValue });
    } catch {
      // A partial number keeps the last valid choice.
      return currentValue;
    }
  };
  if (onUpdateValue) onUpdateValue(update);
  else onChange(update(value));
};
