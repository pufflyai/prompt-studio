import { Button, type ButtonProps, Stack, Text } from "@chakra-ui/react";
import type { ExtensionWorkspaceProvider } from "@pstdio/sdk/extensions";
import {
  buildCommandParamInitialValues,
  type CommandParamValue,
  normalizeCommandParamValues,
  useCommandOptions,
} from "@pstdio/ui/command-form";
import { useState } from "react";
import { WorkspaceProviderFields } from "./provider-fields";
import { workspaceProviderParamSchema } from "./provider-schema";
export type ExecuteOptions = (
  commandId: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<unknown>;
export const ProviderForm = ({
  providers,
  executeOptions,
  submit,
  busy,
}: {
  providers: ExtensionWorkspaceProvider[];
  executeOptions: ExecuteOptions;
  submit: (providerId: string, params: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) => {
  const [selected, setSelected] = useState(providers[0]?.id);
  const provider = providers.find((item) => item.id === selected) ?? providers[0];
  if (!provider) return <Text>Attach a project folder or enable a workspace provider in settings.</Text>;
  return (
    <ProviderParams
      key={provider.id}
      providers={providers}
      provider={provider}
      onProviderChange={setSelected}
      executeOptions={executeOptions}
      submit={submit}
      busy={busy}
    />
  );
};
// psTheme supplies these custom variants; published Chakra types list only built-ins.
const ProviderParams = ({
  providers,
  provider,
  onProviderChange,
  executeOptions,
  submit,
  busy,
}: {
  providers: ExtensionWorkspaceProvider[];
  provider: ExtensionWorkspaceProvider;
  onProviderChange: (id: string) => void;
  executeOptions: ExecuteOptions;
  submit: (id: string, params: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) => {
  const schema = workspaceProviderParamSchema(provider);
  const [values, setValues] = useState<Record<string, CommandParamValue>>(() => buildCommandParamInitialValues(schema));
  const [error, setError] = useState("");
  const setValue = (key: string, value: CommandParamValue) => setValues((current) => ({ ...current, [key]: value }));
  const options = useCommandOptions(schema, values, executeOptions, setValue);
  let validation = Object.values(options.validate(values))[0];
  if (!validation)
    try {
      normalizeCommandParamValues(schema, values);
    } catch (error) {
      validation = String(error);
    }
  return (
    <Stack gap="md">
      <WorkspaceProviderFields
        typeLabel="Workspace type"
        providers={providers}
        provider={provider}
        values={values}
        disabled={busy}
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
      <Button
        variant={"primary" as ButtonProps["variant"]}
        loading={busy}
        disabled={Boolean(validation)}
        onClick={() => {
          void submit(provider.id, normalizeCommandParamValues(schema, values)).catch((error) =>
            setError(String(error)),
          );
        }}
      >
        Create workspace
      </Button>
    </Stack>
  );
};
