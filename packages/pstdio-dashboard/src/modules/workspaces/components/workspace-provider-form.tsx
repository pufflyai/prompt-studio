import { Button, Stack, Text } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { ListRow } from "@pstdio/ui";
import type { CommandParamSchema } from "@pstdio/workbench";
import {
  buildCommandParamInitialValues,
  CommandParamField,
  type CommandParamValue,
  listCommandParamEntries,
  normalizeCommandParamValues,
} from "@pstdio/workbench/react";
import { useState } from "react";

const label = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "default" in value && typeof value.default === "string")
    return value.default;
  return "";
};
const schemaFor = (provider: WorkspaceProviderDescriptor): CommandParamSchema =>
  Object.fromEntries(
    Object.entries(provider.params).map(([key, param]) => [
      key,
      {
        ...param,
        label: label(param.label) || key,
        description: label(param.description),
        ...(Array.isArray(param.options)
          ? { options: param.options.map((option) => ({ ...option, label: label(option.label) })) }
          : {}),
      },
    ]),
  ) as CommandParamSchema;

interface WorkspaceProviderFormProps {
  providers: WorkspaceProviderDescriptor[];
  busy?: boolean;
  onSubmit: (providerId: string, params: Record<string, unknown>) => Promise<void>;
}
const ProviderParameters = (props: {
  provider: WorkspaceProviderDescriptor;
  busy?: boolean;
  onSubmit: WorkspaceProviderFormProps["onSubmit"];
}) => {
  const { provider, busy, onSubmit } = props;
  const schema = schemaFor(provider);
  const [values, setValues] = useState<Record<string, CommandParamValue>>(() => buildCommandParamInitialValues(schema));
  const [error, setError] = useState("");
  const submit = async () => {
    try {
      setError("");
      await onSubmit(provider.id, normalizeCommandParamValues(schema, values));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <Stack gap="sm">
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {label(provider.description)}
      </Text>
      {listCommandParamEntries(schema).map((entry) => (
        <CommandParamField
          key={entry.key}
          entry={entry}
          value={values[entry.key]}
          disabled={Boolean(busy)}
          onChange={(value) => setValues((current) => ({ ...current, [entry.key]: value }))}
        />
      ))}
      {error && (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      )}
      <Button variant="primary" loading={busy} onClick={submit}>
        Open workspace
      </Button>
    </Stack>
  );
};
export const WorkspaceProviderForm = (props: WorkspaceProviderFormProps) => {
  const { providers, busy, onSubmit } = props;
  const [selectedId, setSelectedId] = useState(providers[0]?.id);
  const selected = providers.find((provider) => provider.id === selectedId) ?? providers[0];
  return (
    <Stack gap="md">
      {providers.map((provider) => (
        <ListRow
          key={provider.id}
          id={provider.id}
          label={label(provider.label)}
          isSelected={provider.id === selected?.id}
          disabled={busy}
          onActivate={() => setSelectedId(provider.id)}
        />
      ))}
      {selected ? (
        <ProviderParameters key={selected.id} provider={selected} busy={busy} onSubmit={onSubmit} />
      ) : (
        <Text color="fg.muted">Attach a project folder or enable a workspace provider in settings.</Text>
      )}
    </Stack>
  );
};
