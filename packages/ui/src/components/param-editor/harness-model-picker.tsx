import type { SelectionOption, SelectionParam } from "./param-editor.types";
import { ParamEditorRow } from "./param-editor-row";

interface HarnessModelPickerProps {
  label: string;
  description?: string;
  harnesses: { id: string; name: string; disabled?: boolean }[];
  models: { id: string; name: string; description?: string }[];
  harnessId: string;
  model?: string;
  disabled?: boolean;
  loadingHarnesses?: boolean;
  loadingModels?: boolean;
  onHarnessChange: (id: string) => void;
  onModelChange: (id: string) => void;
}

export const HarnessModelPicker = (props: HarnessModelPickerProps) => {
  const {
    label,
    description,
    harnesses,
    models,
    harnessId,
    model = "",
    disabled,
    loadingHarnesses,
    loadingModels,
    onHarnessChange,
    onModelChange,
  } = props;
  const options: SelectionOption[] = models.map((model) => ({ ...model, icon: "Cpu" }));
  if (loadingModels && options.length === 0)
    options.push({
      id: "model-loading",
      name: "Loading models…",
      icon: "Cpu",
      disabled: true,
    });
  const param: SelectionParam = {
    id: "model",
    name: label,
    description,
    type: "selection",
    defaultValue: model,
    options,
    placeholder: "Select model",
    searchable: models.length > 5,
    searchPlaceholder: "Search models…",
    emptyText: "No models available",
    disabled: disabled || (harnesses.length === 0 && !loadingHarnesses),
    group: {
      id: "harnessId",
      name: "Harness",
      defaultValue: harnessId,
      options: harnesses.map((harness) => ({ ...harness, icon: "Terminal" })),
      placeholder: loadingHarnesses ? "Loading harnesses…" : "Select harness",
      searchable: harnesses.length > 10,
      searchPlaceholder: "Search harnesses…",
      emptyText: "No harnesses available",
      disabled: disabled || loadingHarnesses || harnesses.length <= 1,
    },
  };
  return (
    <ParamEditorRow
      param={param}
      values={{ model, harnessId }}
      onChange={(id, value) => {
        if (typeof value !== "string") return;
        if (id === "harnessId") onHarnessChange(value);
        if (id === "model") onModelChange(value);
      }}
    />
  );
};
