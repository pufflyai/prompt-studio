import { Box } from "@chakra-ui/react";
import type { Param, ParamValue, ParamValueMap, ResourceRefValue } from "./param-editor.types";
import { ParamEditorField } from "./param-editor-field";

export interface ParamEditorRowProps {
  param: Param;
  values?: ParamValueMap;
  onChange?: (id: string, value: ParamValue) => void;
  onOpenResource?: (ref: ResourceRefValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
  variant?: "default" | "small";
}

/**
 * The padded field row every param surface is built from. Surfaces that compose
 * their own list of fields — a command dialog mixing built-in and host-supplied
 * controls — stack these instead of nesting one editor per field, so the whole
 * form keeps a single rhythm.
 */
export const ParamEditorRow = (props: ParamEditorRowProps) => {
  const { param, values = {}, onChange, onOpenResource, readOnly, fullWidth, variant = "default" } = props;
  const small = variant === "small";

  return (
    <Box px="sm" py={small ? "2xs" : "xs"}>
      <ParamEditorField
        param={param}
        defaultValues={values}
        onChange={onChange ?? (() => undefined)}
        onOpenResource={onOpenResource}
        readOnly={readOnly}
        fullWidth={fullWidth}
        size={small ? "xs" : "sm"}
      />
    </Box>
  );
};
