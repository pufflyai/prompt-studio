import { Box, Flex } from "@chakra-ui/react";
import { ActionInput } from "./inputs/action-input";
import { AnchorGridInput } from "./inputs/anchor-grid-input";
import { ColorInput } from "./inputs/color-input";
import { DateInput } from "./inputs/date-input";
import { FileDropInput } from "./inputs/file-drop-input";
import { NumberInput } from "./inputs/number-input";
import { RangeInput } from "./inputs/range-input";
import { ResourceInput } from "./inputs/resource-input";
import { SegmentedInput } from "./inputs/segmented-input";
import { SelectionInput } from "./inputs/selection-input";
import { TextInput } from "./inputs/text-input";
import { VectorInput } from "./inputs/vector-input";
import type { Param, ParamValue, ParamValueMap, ResourceRefValue } from "./param-editor.types";
import { ParamEditorLabel } from "./param-editor-label";
import { ParamEditorReadOnlyValue } from "./param-editor-read-only-value";

interface ParamEditorFieldProps {
  param: Param;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  onOpenResource?: (ref: ResourceRefValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

const PropertyField = (props: { param: Extract<Param, { type: "property" }>; fullWidth?: boolean }) => {
  const { param, fullWidth } = props;

  if (fullWidth) {
    return (
      <Box>
        <Box mb="xs">
          <ParamEditorLabel name={param.name} description={param.description} />
        </Box>
        <ParamEditorReadOnlyValue>{param.value}</ParamEditorReadOnlyValue>
      </Box>
    );
  }

  return (
    <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
      <ParamEditorLabel name={param.name} description={param.description} />
      <ParamEditorReadOnlyValue>{param.value}</ParamEditorReadOnlyValue>
    </Flex>
  );
};

export const ParamEditorField = (props: ParamEditorFieldProps) => {
  const { param, defaultValues, onChange, onOpenResource, readOnly, fullWidth = false } = props;
  const common = { id: param.id, readOnly, onChange, fullWidth };

  switch (param.type) {
    case "number":
      return (
        <NumberInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          step={param.step}
        />
      );
    case "text":
      return (
        <TextInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          singleLine={param.singleLine}
        />
      );
    case "selection":
      return (
        <SelectionInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          multiSelect={param.multiSelect}
          placeholder={param.placeholder}
        />
      );
    case "date":
      return (
        <DateInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
        />
      );
    case "color":
      return (
        <ColorInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
        />
      );
    case "property":
      return <PropertyField param={param} fullWidth={fullWidth} />;
    case "resource":
      return (
        <ResourceInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          multiSelect={param.multiSelect}
          editable={param.editable}
          placeholder={param.placeholder}
          emptyText={param.emptyText}
          onOpenResource={onOpenResource}
        />
      );
    case "range":
      return (
        <RangeInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          step={param.step}
          unit={param.unit}
          markerCount={param.markerCount}
        />
      );
    case "segmented":
      return (
        <SegmentedInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          variant={param.variant}
        />
      );
    case "actions":
      return (
        <ActionInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
        />
      );
    case "anchorGrid":
      return (
        <AnchorGridInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
        />
      );
    case "vector":
      return (
        <VectorInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          xLabel={param.xLabel}
          yLabel={param.yLabel}
          min={param.min}
          max={param.max}
          step={param.step}
        />
      );
    case "fileDrop":
      return (
        <FileDropInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          accept={param.accept}
          assetKind={param.assetKind}
        />
      );
    default:
      return null;
  }
};
