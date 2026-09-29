import { Text } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import type { WorkbenchCore } from "@pstdio/workbench";
import {
  buildCommandParamInitialValues,
  type CommandParamFieldProps,
  type CommandParamValue,
  commandParamName,
  normalizeCommandParamValues,
} from "@pstdio/workbench/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { WorkspaceProviderFields, workspaceProviderParamSchema } from "@/shared/workspaces/workspace-provider-fields";
import { workspaceProvidersQueryOptions } from "@/shared/workspaces/workspace-providers";
import { parseParamRecord, serializeParamRecord } from "./param-field-shared";

interface WorkspaceParamFieldProps extends CommandParamFieldProps {
  workbench: WorkbenchCore;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readWorkspace = (value: CommandParamValue) => {
  const record = parseParamRecord(value);
  return {
    providerId: typeof record.providerId === "string" ? record.providerId : "",
    params: isRecord(record.params) ? record.params : {},
  };
};

// Required provider params are checked when the workspace is created, so the
// field keeps partial input instead of failing on every keystroke.
const serializeWorkspace = (provider: WorkspaceProviderDescriptor, values: Record<string, CommandParamValue>) => {
  const schema = Object.fromEntries(
    Object.entries(workspaceProviderParamSchema(provider)).map(([key, param]) => [key, { ...param, required: false }]),
  );
  return serializeParamRecord({ providerId: provider.id, params: normalizeCommandParamValues(schema, values) });
};

const defaultValues = (provider: WorkspaceProviderDescriptor) =>
  buildCommandParamInitialValues(workspaceProviderParamSchema(provider));

// Defaults apply once, when a provider is chosen. Reading the stored choice
// without them lets the user clear a field that has a default.
const storedValues = (provider: WorkspaceProviderDescriptor, params: Record<string, unknown>) =>
  buildCommandParamInitialValues(
    Object.fromEntries(
      Object.entries(workspaceProviderParamSchema(provider)).map(([key, { defaultValue: _, ...param }]) => [
        key,
        param,
      ]),
    ),
    params,
  );

export const WorkspaceParamField = (props: WorkspaceParamFieldProps) => {
  const { entry, value, disabled, onChange, workbench } = props;
  const projectId = getDashboardSelectedProjectId(workbench);
  const query = useQuery(workspaceProvidersQueryOptions(projectId));
  const providers = (query.data ?? []).filter((provider) => !entry.providers || entry.providers.includes(provider.id));
  const stored = readWorkspace(value);
  const provider = providers.find((candidate) => candidate.id === stored.providerId);
  const fallback = providers[0];

  useEffect(() => {
    // The dialog starts without a choice; commit the first offered provider and
    // its defaults so the command receives what the form shows.
    if (provider || !fallback) return;
    onChange(serializeWorkspace(fallback, defaultValues(fallback)));
  }, [fallback, onChange, provider]);

  // A refetch failure keeps the last known providers on screen.
  if (query.error && !query.data) {
    return (
      <Text role="alert" color="fg.error">
        {query.error.message}
      </Text>
    );
  }
  if (query.isPending) return <Text color="fg.muted">Loading workspace types...</Text>;
  const selected = provider ?? fallback;
  if (!selected) {
    return <Text color="fg.muted">This project has no workspace type that can run this command.</Text>;
  }

  const values = provider ? storedValues(provider, stored.params) : defaultValues(selected);
  return (
    <WorkspaceProviderFields
      typeLabel={commandParamName(entry)}
      providers={providers}
      provider={selected}
      values={values}
      disabled={disabled}
      onProviderChange={(providerId) => {
        const next = providers.find((candidate) => candidate.id === providerId);
        if (next) onChange(serializeWorkspace(next, defaultValues(next)));
      }}
      onValueChange={(key, nextValue) => {
        try {
          onChange(serializeWorkspace(selected, { ...values, [key]: nextValue }));
        } catch {
          // An unparsable value (e.g. a partial number) keeps the last valid choice.
        }
      }}
    />
  );
};
