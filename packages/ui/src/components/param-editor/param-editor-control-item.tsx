import { Box, Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ParamEditorFieldLabel } from "./param-editor-field-label";

type ControlItemOrientation = "auto" | "inline" | "stacked";

interface ParamEditorControlItemProps {
  name?: string;
  description?: string;
  hideLabel?: boolean;
  fullWidth?: boolean;
  /** `auto` renders inline when compact and stacked when full-width. */
  orientation?: ControlItemOrientation;
  /** Rendered on the label row, right-aligned (e.g. an editable value readout). */
  labelTrailing?: ReactNode;
  children: ReactNode;
}

// Shared row scaffold for control layouts: a labelled control that renders either
// inline (label left / control right) or stacked (label above the control).
export const ParamEditorControlItem = (props: ParamEditorControlItemProps) => {
  const {
    name,
    description,
    hideLabel = false,
    fullWidth = false,
    orientation = "auto",
    labelTrailing,
    children,
  } = props;

  const label = hideLabel || !name ? null : <ParamEditorFieldLabel name={name} description={description} />;
  const resolved = orientation === "auto" ? (fullWidth ? "stacked" : "inline") : orientation;

  if (resolved === "stacked") {
    const header = label || labelTrailing;
    return (
      <Box minW="0">
        {header ? (
          <Flex alignItems="center" justifyContent="space-between" gap="xs" mb="xs" minW="0">
            {label}
            {labelTrailing}
          </Flex>
        ) : null}
        {children}
      </Box>
    );
  }

  return (
    <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs" minW="0">
      {label}
      <Flex alignItems="center" gap="xs" minW="0">
        {labelTrailing}
        {children}
      </Flex>
    </Flex>
  );
};
