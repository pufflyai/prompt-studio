import { Text } from "@chakra-ui/react";
import type { ControlValue, HarnessControl as HarnessControlDeclaration } from "@pstdio/sdk/extensions";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";

interface HarnessControlProps {
  param: HarnessControlDeclaration;
  value: ControlValue;
  readOnly: boolean;
  renderParamField?: CommandParamFieldRenderer;
  onChange: (value: ControlValue) => void;
}

export const HarnessControl = (props: HarnessControlProps) => {
  const { param, value, readOnly, renderParamField, onChange } = props;
  const field = renderParamField?.({
    entry: { key: param.id, label: param.name, description: param.description, type: "harness", required: true },
    value: JSON.stringify(value),
    disabled: readOnly || Boolean(param.readOnly),
    onChange: (next) => {
      if (!readOnly && !param.readOnly && typeof next === "string") onChange(JSON.parse(next));
    },
  });
  if (field) return field;
  return (
    <Text textStyle="label/S/regular" color="fg.muted">
      Harness selection is unavailable in this host.
    </Text>
  );
};
