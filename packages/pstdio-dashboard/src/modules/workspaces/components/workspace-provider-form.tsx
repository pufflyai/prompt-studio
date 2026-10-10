import { Button, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import {
  buildCommandParamInitialValues,
  type CommandParamValue,
  type ExecuteOptionCommand,
  normalizeCommandParamValues,
  useCommandOptions,
} from "@pstdio/workbench/react";
import { useState } from "react";
import { WorkspaceProviderFields } from "@/shared/workspaces/workspace-provider-fields";
import { workspaceProviderParamSchema } from "@/shared/workspaces/workspace-provider-param-schema";

interface WorkspaceProviderFormProps {
  providers: WorkspaceProviderDescriptor[];
  busy?: boolean;
  executeOptionCommand?: ExecuteOptionCommand;
  onCancel: () => void;
  onSubmit: (providerId: string, params: Record<string, unknown>) => Promise<void>;
}

interface ProviderParametersProps {
  providers: WorkspaceProviderDescriptor[];
  provider: WorkspaceProviderDescriptor;
  busy?: boolean;
  executeOptionCommand?: ExecuteOptionCommand;
  onProviderChange: (providerId: string) => void;
  onCancel: WorkspaceProviderFormProps["onCancel"];
  onSubmit: WorkspaceProviderFormProps["onSubmit"];
}

const ProviderParameters = (props: ProviderParametersProps) => {
  const { providers, provider, busy, executeOptionCommand, onProviderChange, onCancel, onSubmit } = props;
  const schema = workspaceProviderParamSchema(provider);
  const [values, setValues] = useState<Record<string, CommandParamValue>>(() => buildCommandParamInitialValues(schema));
  const [error, setError] = useState("");
  const setValue = (key: string, value: CommandParamValue) => setValues((current) => ({ ...current, [key]: value }));
  const options = useCommandOptions(schema, values, executeOptionCommand, setValue);
  let validationError = Object.values(options.validate(values))[0];
  if (!validationError) {
    try {
      normalizeCommandParamValues(schema, values);
    } catch (error) {
      validationError = error instanceof Error ? error.message : String(error);
    }
  }
  const submit = async () => {
    if (busy || validationError) return;
    try {
      setError("");
      await onSubmit(provider.id, normalizeCommandParamValues(schema, values));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <>
      <Dialog.Body>
        <Stack gap="sm">
          <WorkspaceProviderFields
            typeLabel="Workspace type"
            providers={providers}
            provider={provider}
            values={values}
            disabled={Boolean(busy)}
            optionStates={options.states}
            onRetryOptions={options.retry}
            onProviderChange={onProviderChange}
            onValueChange={setValue}
          />
          {error && (
            <Text role="alert" color="fg.error">
              {error}
            </Text>
          )}
        </Stack>
      </Dialog.Body>
      <Dialog.Footer justifyContent="end">
        <HStack gap="2">
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={Boolean(validationError)} loading={busy} onClick={submit}>
            Create workspace
          </Button>
        </HStack>
      </Dialog.Footer>
    </>
  );
};

export const WorkspaceProviderForm = (props: WorkspaceProviderFormProps) => {
  const { providers, busy, executeOptionCommand, onCancel, onSubmit } = props;
  const [selectedId, setSelectedId] = useState(providers[0]?.id);
  const selected = providers.find((provider) => provider.id === selectedId) ?? providers[0];
  if (!selected) {
    return (
      <>
        <Dialog.Body>
          <Text color="fg.muted">Attach a project folder or enable a workspace provider in settings.</Text>
        </Dialog.Body>
        <Dialog.Footer justifyContent="end">
          <HStack gap="2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" disabled>
              Create workspace
            </Button>
          </HStack>
        </Dialog.Footer>
      </>
    );
  }
  return (
    <ProviderParameters
      key={JSON.stringify(selected)}
      providers={providers}
      provider={selected}
      busy={busy}
      executeOptionCommand={executeOptionCommand}
      onProviderChange={setSelectedId}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
};
