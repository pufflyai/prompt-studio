import { ActionControl } from "./controls/action-control";
import { AnchorGridControl } from "./controls/anchor-grid-control";
import { CodeTextareaControl } from "./controls/code-textarea-control";
import { ColorOpacityControl } from "./controls/color-opacity-control";
import { FileDropControl } from "./controls/file-drop-control";
import { RangeSliderControl } from "./controls/range-slider-control";
import { SegmentedControl } from "./controls/segmented-control";
import { SliderControl } from "./controls/slider-control";
import { VectorControl } from "./controls/vector-control";
import type { Param, ParamValue, ParamValueMap } from "./param-editor.types";

interface ParamEditorControlFieldProps {
  param: Param;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

// Dispatches the rich authoring controls added on top of the built-in fields. Kept
// separate from ParamEditorField so each switch stays small and readable.
export const ParamEditorControlField = (props: ParamEditorControlFieldProps) => {
  const { param, defaultValues, onChange, readOnly, fullWidth = false } = props;

  switch (param.type) {
    case "slider":
      return (
        <SliderControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          step={param.step}
          unit={param.unit}
          markerCount={param.markerCount}
          baseValue={param.baseValue}
          variant={param.variant}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "range":
      return (
        <RangeSliderControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          step={param.step}
          unit={param.unit}
          markerCount={param.markerCount}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "segmented":
      return (
        <SegmentedControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          variant={param.variant}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "actions":
      return (
        <ActionControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "anchorGrid":
      return (
        <AnchorGridControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "vector":
      return (
        <VectorControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          xLabel={param.xLabel}
          yLabel={param.yLabel}
          min={param.min}
          max={param.max}
          step={param.step}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "code":
      return (
        <CodeTextareaControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          language={param.language}
          minRows={param.minRows}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "fileDrop":
      return (
        <FileDropControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          accept={param.accept}
          assetKind={param.assetKind}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "colorOpacity":
      return (
        <ColorOpacityControl
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    default:
      return null;
  }
};
