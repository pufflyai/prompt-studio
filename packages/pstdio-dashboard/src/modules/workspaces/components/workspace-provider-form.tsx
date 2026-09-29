import { Button, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import {
  buildCommandParamInitialValues,
  type CommandParamValue,
  normalizeCommandParamValues,
} from "@pstdio/workbench/react";
import { useState } from "react";
import { WorkspaceProviderFields, workspaceProviderParamSchema } from "@/shared/workspaces/workspace-provider-fields";

interface WorkspaceProviderFormProps {
  providers: WorkspaceProviderDescriptor[];
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (providerId: string, params: Record<string, unknown>) => Promise<void>;
}

interface ProviderParametersProps {
  providers: WorkspaceProviderDescriptor[];
  provider: WorkspaceProviderDescriptor;
  busy?: boolean;
  onProviderChange: (providerId: string) => void;
  onCancel: WorkspaceProviderFormProps["onCancel"];
  onSubmit: WorkspaceProviderFormProps["onSubmit"];
}

const ProviderParameters = (props: ProviderParametersProps) => {
  const { providers, provider, busy, onProviderChange, onCancel, onSubmit } = props;
  const schema = workspaceProviderParamSchema(provider);
  const [values, setValues] = useState<Record<string, CommandParamValue>>(() => buildCommandParamInitialValues(schema));
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy) return;
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
            onProviderChange={onProviderChange}
            onValueChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
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
          <Button variant="primary" loading={busy} onClick={submit}>
            Create workspace
          </Button>
        </HStack>
      </Dialog.Footer>
    </>
  );
};

export const WorkspaceProviderForm = (props: WorkspaceProviderFormProps) => {
  const { providers, busy, onCancel, onSubmit } = props;
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
      key={selected.id}
      providers={providers}
      provider={selected}
      busy={busy}
      onProviderChange={setSelectedId}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
};
