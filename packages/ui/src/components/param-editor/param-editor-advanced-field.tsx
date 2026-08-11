import { ActionInput } from "./inputs/action-input";
import { AnchorGridInput } from "./inputs/anchor-grid-input";
import { FileUploadInput } from "./inputs/file-upload-input";
import { RangeInput } from "./inputs/range-input";
import { SegmentedInput } from "./inputs/segmented-input";
import { VectorInput } from "./inputs/vector-input";
import type { Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { resolveParamValue } from "./resolve-param-value";

type AdvancedParam = Extract<
  Param,
  { type: "range" | "segmented" | "actions" | "anchorGrid" | "vector" | "fileUpload" }
>;

interface ParamEditorAdvancedFieldProps {
  param: AdvancedParam;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
  presentation: "stacked" | "horizontal";
}

export const ParamEditorAdvancedField = (props: ParamEditorAdvancedFieldProps) => {
  const { param, defaultValues, onChange, readOnly, fullWidth, presentation } = props;
  const common = {
    id: param.id,
    readOnly: readOnly || param.readOnly,
    onChange,
    fullWidth: presentation === "horizontal" ? false : fullWidth,
  };

  switch (param.type) {
    case "range":
      return (
        <RangeInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          step={param.step}
          unit={param.unit}
          markerCount={param.markerCount}
          presentation={presentation}
        />
      );
    case "segmented":
      return (
        <SegmentedInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          variant={param.variant}
          presentation={presentation}
        />
      );
    case "actions":
      return (
        <ActionInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          presentation={presentation}
        />
      );
    case "anchorGrid":
      if (presentation === "horizontal") return null;
      return (
        <AnchorGridInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
        />
      );
    case "vector":
      return (
        <VectorInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          xLabel={param.xLabel}
          yLabel={param.yLabel}
          min={param.min}
          max={param.max}
          step={param.step}
        />
      );
    case "fileUpload":
      return (
        <FileUploadInput
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          accept={param.accept}
          multiple={param.multiple}
          uploadLabel={param.uploadLabel}
          readOnly={common.readOnly}
          presentation={presentation}
          onChange={onChange}
        />
      );
  }
};
