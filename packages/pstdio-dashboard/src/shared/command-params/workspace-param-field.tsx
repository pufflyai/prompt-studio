import { Text } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import type { WorkbenchCore } from "@pstdio/workbench";
import {
  type CommandParamFieldProps,
  type CommandParamValue,
  commandParamName,
  normalizeCommandParamValues,
  useCommandOptions,
} from "@pstdio/workbench/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { executeExtensionCommandValue } from "@/shared/extensions/api";
import { WorkspaceProviderFields } from "@/shared/workspaces/workspace-provider-fields";
import { workspaceProviderParamSchema } from "@/shared/workspaces/workspace-provider-param-schema";
import { workspaceProvidersQueryOptions } from "@/shared/workspaces/workspace-providers";
import {
  changeWorkspaceParamValue,
  defaultWorkspaceValues,
  readWorkspace,
  serializeWorkspace,
  storedWorkspaceValues,
} from "./workspace-param-values";

interface WorkspaceParamFieldProps extends CommandParamFieldProps {
  workbench: WorkbenchCore;
}

export const WorkspaceParamField = (props: WorkspaceParamFieldProps) => {
  const { entry, value, onChange, workbench } = props;
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
    onChange(serializeWorkspace(fallback, defaultWorkspaceValues(fallback)));
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

  const values = provider ? storedWorkspaceValues(provider, stored.params) : defaultWorkspaceValues(selected);
  return (
    <WorkspaceParameterFields
      key={JSON.stringify([projectId, selected])}
      {...props}
      projectId={projectId}
      providers={providers}
      provider={selected}
      values={values}
      onProviderChange={(providerId) => {
        const next = providers.find((candidate) => candidate.id === providerId);
        if (next) onChange(serializeWorkspace(next, defaultWorkspaceValues(next)));
      }}
      onValueChange={(key, nextValue) => changeWorkspaceParamValue({ ...props, provider: selected }, key, nextValue)}
    />
  );
};

interface WorkspaceParameterFieldsProps extends WorkspaceParamFieldProps {
  projectId: string | undefined;
  providers: WorkspaceProviderDescriptor[];
  provider: WorkspaceProviderDescriptor;
  values: Record<string, CommandParamValue>;
  onProviderChange: (id: string) => void;
  onValueChange: (key: string, value: CommandParamValue) => void;
}

const WorkspaceParameterFields = (props: WorkspaceParameterFieldsProps) => {
  const {
    entry,
    disabled,
    onValidationChange,
    projectId,
    provider,
    values,
    providers,
    onProviderChange,
    onValueChange,
  } = props;
  const schema = workspaceProviderParamSchema(provider);
  const validationCallback = useRef(onValidationChange);
  validationCallback.current = onValidationChange;
  const options = useCommandOptions(
    schema,
    values,
    (commandId, params, signal) => {
      if (!projectId) return Promise.reject(new Error("Workspace choices need a project."));
      return executeExtensionCommandValue(projectId, commandId, params, signal);
    },
    onValueChange,
  );
  let validationError = Object.values(options.validate(values))[0];
  if (!validationError) {
    try {
      normalizeCommandParamValues(schema, values);
    } catch (error) {
      validationError = error instanceof Error ? error.message : String(error);
    }
  }
  useEffect(() => {
    validationCallback.current?.(validationError);
  }, [validationError]);
  useEffect(() => () => validationCallback.current?.(undefined), []);
  return (
    <WorkspaceProviderFields
      typeLabel={commandParamName(entry)}
      providers={providers}
      provider={provider}
      values={values}
      disabled={disabled}
      optionStates={options.states}
      onRetryOptions={options.retry}
      onProviderChange={onProviderChange}
      onValueChange={onValueChange}
    />
  );
};
