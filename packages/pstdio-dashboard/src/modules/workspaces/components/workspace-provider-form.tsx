import { Button, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { isLocalizedString } from "@pstdio/sdk/extensions";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import type { CommandParamSchema } from "@pstdio/workbench";
import {
  buildCommandParamInitialValues,
  CommandParamField,
  type CommandParamValue,
  listCommandParamEntries,
  normalizeCommandParamValues,
} from "@pstdio/workbench/react";
import { type ReactNode, useState } from "react";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";

const label = (value: unknown) =>
  typeof value === "string" || isLocalizedString(value) ? resolveLocalizableString(value) : "";

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
  onCancel: () => void;
  onSubmit: (providerId: string, params: Record<string, unknown>) => Promise<void>;
}

interface ProviderParametersProps {
  provider: WorkspaceProviderDescriptor;
  busy?: boolean;
  children: ReactNode;
  onCancel: WorkspaceProviderFormProps["onCancel"];
  onSubmit: WorkspaceProviderFormProps["onSubmit"];
}

const ProviderParameters = (props: ProviderParametersProps) => {
  const { provider, busy, children, onCancel, onSubmit } = props;
  const schema = schemaFor(provider);
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
          {children}
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
    <ProviderParameters key={selected.id} provider={selected} busy={busy} onCancel={onCancel} onSubmit={onSubmit}>
      <ParamEditorRow
        param={{
          id: "workspace-type",
          type: "selection",
          name: "Workspace type",
          description: label(selected.description),
          options: providers.map((provider) => ({ id: provider.id, name: label(provider.label), icon: provider.icon })),
          defaultValue: selected.id,
          clearable: false,
        }}
        readOnly={Boolean(busy)}
        onChange={(_id, value) => {
          if (typeof value === "string") setSelectedId(value);
        }}
      />
    </ProviderParameters>
  );
};
