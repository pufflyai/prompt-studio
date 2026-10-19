import { Text } from "@chakra-ui/react";
import type { ExtensionHarnessInput, GuestHost } from "@pstdio/sdk/extensions";
import { filterHarnessParamValues, HarnessModelPicker, HarnessParamEditor } from "@pstdio/ui/param-editor";
import { useEffect, useEffectEvent, useState } from "react";

interface SupervisorModelFieldProps {
  host: GuestHost;
  label: string;
  value?: ExtensionHarnessInput;
  disabled: boolean;
  onChange: (value: ExtensionHarnessInput) => void;
}

export function SupervisorModelField(props: SupervisorModelFieldProps) {
  const { host, label, value, disabled, onChange } = props;
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof readCatalog>>>();
  const [error, setError] = useState<string>();
  const harnessId = value?.harnessId;
  const model = value?.model;
  const applyCatalog = useEffectEvent((next: Awaited<ReturnType<typeof readCatalog>>) => {
    setCatalog(next);
    if (!value && next.selection) onChange(next.selection);
    else if (value && next.selection)
      onChange({ ...next.selection, params: filterHarnessParamValues(next.schema, value.params) });
  });
  useEffect(() => {
    let active = true;
    setError(undefined);
    void readCatalog(host, harnessId, model)
      .then((next) => {
        if (!active) return;
        applyCatalog(next);
      })
      .catch((reason) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
    };
  }, [host, harnessId, model]);
  return (
    <>
      <HarnessModelPicker
        label={label}
        harnesses={(catalog?.harnesses ?? []).map((harness) => ({
          id: harness.id,
          name: harness.name,
          disabled: harness.availability.type === "NOT_FOUND",
        }))}
        models={(catalog?.models ?? []).map((model) => ({
          id: model.id,
          name: model.label ?? model.id,
          description: model.description,
        }))}
        harnessId={harnessId ?? ""}
        model={model}
        disabled={disabled}
        loadingHarnesses={!catalog}
        loadingModels={!catalog}
        onHarnessChange={(harnessId) => onChange({ harnessId })}
        onModelChange={(model) => onChange({ harnessId: harnessId!, model, params: value?.params })}
      />
      <HarnessParamEditor
        schema={catalog?.schema}
        defaults={catalog?.defaults}
        overrides={value?.params ?? {}}
        disabled={disabled}
        onOverridesChange={(params) => onChange({ ...value!, params })}
      />
      {error ? (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      ) : null}
    </>
  );
}

const readCatalog = (host: GuestHost, harnessId?: string, model?: string) =>
  host.call("harnesses.read", { harnessId, model });
