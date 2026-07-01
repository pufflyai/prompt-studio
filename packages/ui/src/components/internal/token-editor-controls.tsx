import { Box, HStack } from "@chakra-ui/react";
import type { TokenEditorToken } from "@/components/internal/token-editor-data";
import { ColorInput } from "@/components/param-editor/inputs/color-input";
import { NumberInput } from "@/components/param-editor/inputs/number-input";
import { SelectionInput } from "@/components/param-editor/inputs/selection-input";
import { TextInput } from "@/components/param-editor/inputs/text-input";
import type { ParamValue } from "@/components/param-editor/param-editor.types";

interface TokenEditorControlProps {
  token: TokenEditorToken;
  value: string;
  onValueChange: (tokenId: string, value: string) => void;
}

interface TokenSelectOption {
  label: string;
  value: string;
}

interface DimensionValue {
  amount: string;
  unit: string;
}

interface BorderValue {
  color: string;
  style: string;
  width: string;
  unit: string;
}

const dimensionUnitOptions: TokenSelectOption[] = [
  { label: "none", value: "" },
  { label: "rem", value: "rem" },
  { label: "px", value: "px" },
  { label: "em", value: "em" },
  { label: "%", value: "%" },
];

const borderUnitOptions = dimensionUnitOptions.filter((option) => option.value);

const borderStyleOptions: TokenSelectOption[] = [
  { label: "solid", value: "solid" },
  { label: "dashed", value: "dashed" },
  { label: "dotted", value: "dotted" },
  { label: "double", value: "double" },
  { label: "none", value: "none" },
];

const fontOptions: TokenSelectOption[] = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Onest", value: "Onest, sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
];

const colorPattern = /^#(?:[\da-f]{3}){1,2}$/i;
const dimensionPattern = /^(-?(?:\d+|\d*\.\d+))([a-z%]*)$/i;
const borderPattern = /^(-?(?:\d+|\d*\.\d+))([a-z%]+)\s+([a-z-]+)\s+(.+)$/i;

const isColorValue = (value: string) => colorPattern.test(value.trim());

const numberInputValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const colorInputValue = (value: string) => {
  const trimmed = value.trim();

  if (/^#[\da-f]{6}$/i.test(trimmed)) return trimmed;

  if (/^#[\da-f]{3}$/i.test(trimmed)) {
    const [, red, green, blue] = trimmed;
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  return "#000000";
};

const withCurrentOption = (options: TokenSelectOption[], value: string) => {
  if (options.some((option) => option.value === value)) return options;
  return [{ label: value || "Custom", value }, ...options];
};

const parseDimensionValue = (value: string): DimensionValue | null => {
  const match = value.trim().match(dimensionPattern);
  if (!match) return null;

  return {
    amount: match[1] ?? "0",
    unit: match[2] ?? "",
  };
};

const formatDimensionValue = (parts: DimensionValue) => `${parts.amount || "0"}${parts.unit}`;

const parseBorderValue = (value: string): BorderValue | null => {
  const match = value.trim().match(borderPattern);
  if (!match) return null;

  return {
    width: match[1] ?? "1",
    unit: match[2] ?? "px",
    style: match[3] ?? "solid",
    color: match[4] ?? "#000000",
  };
};

const formatBorderValue = (parts: BorderValue) => `${parts.width || "0"}${parts.unit} ${parts.style} ${parts.color}`;

const TokenSelectionInput = (props: {
  label: string;
  options: TokenSelectOption[];
  value: string;
  width?: string;
  onChange: (value: string) => void;
}) => {
  const { label, options, value, width = "100%", onChange } = props;

  return (
    <Box width={width} minW="0">
      <SelectionInput
        id={label}
        name={label}
        description=""
        defaultValue={value}
        options={withCurrentOption(options, value).map((option) => ({ id: option.value, name: option.label }))}
        onChange={(_, nextValue: ParamValue) => {
          if (!Array.isArray(nextValue)) onChange(String(nextValue ?? ""));
        }}
        hideLabel
        fullWidth
      />
    </Box>
  );
};

const NumberValueInput = (props: {
  label: string;
  value: string;
  width?: string;
  step?: number;
  onChange: (value: string) => void;
}) => {
  const { label, value, width = "6rem", step = 1, onChange } = props;

  return (
    <Box width={width} minW="0">
      <NumberInput
        id={label}
        name={label}
        description=""
        defaultValue={numberInputValue(value)}
        step={step}
        onChange={(_, nextValue) => onChange(String(nextValue))}
        hideLabel
        hideSlider
        fullWidth
      />
    </Box>
  );
};

const FallbackValueInput = (props: TokenEditorControlProps) => {
  const { token, value, onValueChange } = props;

  return (
    <TextInput
      id={`${token.id} value`}
      name={`${token.id} value`}
      description=""
      defaultValue={value}
      onChange={(_, nextValue) => onValueChange(token.id, nextValue)}
      hideLabel
      fullWidth
    />
  );
};

const ColorTokenEditor = (props: TokenEditorControlProps) => {
  const { token, value, onValueChange } = props;

  if (!isColorValue(value)) return <FallbackValueInput {...props} />;

  return (
    <ColorInput
      id={`${token.id} color`}
      name={`${token.id} color`}
      description=""
      defaultValue={colorInputValue(value)}
      onChange={(_, nextValue) => onValueChange(token.id, nextValue)}
      hideLabel
      fullWidth
    />
  );
};

const FontTokenEditor = (props: TokenEditorControlProps) => {
  const { token, value, onValueChange } = props;

  return (
    <TokenSelectionInput
      label={`${token.id} font family`}
      value={value}
      options={fontOptions}
      onChange={(nextValue) => onValueChange(token.id, nextValue)}
    />
  );
};

const NumberTokenEditor = (props: TokenEditorControlProps) => {
  const { token, value, onValueChange } = props;

  return (
    <NumberValueInput
      label={`${token.id} number`}
      value={value}
      onChange={(nextValue) => onValueChange(token.id, nextValue)}
    />
  );
};

const DimensionTokenEditor = (props: TokenEditorControlProps) => {
  const { token, value, onValueChange } = props;
  const parsed = parseDimensionValue(value);

  if (!parsed) return <FallbackValueInput {...props} />;

  const update = (nextParts: Partial<DimensionValue>) => {
    onValueChange(token.id, formatDimensionValue({ ...parsed, ...nextParts }));
  };

  return (
    <HStack gap="2xs" minW="0">
      <NumberValueInput
        label={`${token.id} number`}
        value={parsed.amount}
        width="5rem"
        step={0.125}
        onChange={(nextValue) => update({ amount: nextValue })}
      />
      <TokenSelectionInput
        label={`${token.id} unit`}
        value={parsed.unit}
        options={dimensionUnitOptions}
        width="5rem"
        onChange={(nextValue) => update({ unit: nextValue })}
      />
    </HStack>
  );
};

const BorderTokenEditor = (props: TokenEditorControlProps) => {
  const { token, value, onValueChange } = props;
  const parsed = parseBorderValue(value);

  if (!parsed) return <FallbackValueInput {...props} />;

  const update = (nextParts: Partial<BorderValue>) => {
    onValueChange(token.id, formatBorderValue({ ...parsed, ...nextParts }));
  };

  return (
    <HStack gap="2xs" minW="0" flexWrap="wrap">
      <NumberValueInput
        label={`${token.id} border width`}
        value={parsed.width}
        width="4.5rem"
        step={0.5}
        onChange={(nextValue) => update({ width: nextValue })}
      />
      <TokenSelectionInput
        label={`${token.id} border width unit`}
        value={parsed.unit}
        options={borderUnitOptions}
        width="4.5rem"
        onChange={(nextValue) => update({ unit: nextValue })}
      />
      <TokenSelectionInput
        label={`${token.id} border style`}
        value={parsed.style}
        options={borderStyleOptions}
        width="6rem"
        onChange={(nextValue) => update({ style: nextValue })}
      />
      {isColorValue(parsed.color) ? (
        <Box width="8.75rem" minW="0">
          <ColorInput
            id={`${token.id} border color`}
            name={`${token.id} border color`}
            description=""
            defaultValue={colorInputValue(parsed.color)}
            onChange={(_, nextValue) => update({ color: nextValue })}
            hideLabel
            fullWidth
          />
        </Box>
      ) : (
        <Box width="8rem" minW="0">
          <TextInput
            id={`${token.id} border color`}
            name={`${token.id} border color`}
            description=""
            defaultValue={parsed.color}
            onChange={(_, nextValue) => update({ color: nextValue })}
            hideLabel
            fullWidth
          />
        </Box>
      )}
    </HStack>
  );
};

export const TokenValueEditor = (props: TokenEditorControlProps) => {
  const { token } = props;

  if (token.kind === "color") return <ColorTokenEditor {...props} />;
  if (token.kind === "font") return <FontTokenEditor {...props} />;
  if (token.kind === "number") return <NumberTokenEditor {...props} />;
  if (token.kind === "dimension") return <DimensionTokenEditor {...props} />;
  if (token.kind === "border") return <BorderTokenEditor {...props} />;

  return <FallbackValueInput {...props} />;
};
