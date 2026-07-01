import { Box, Grid, IconButton } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { AnchorGridValue } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { ParamEditorReadOnlyValue } from "../param-editor-read-only-value";
import { ANCHOR_GRID_VALUES } from "./anchor-grid";

interface AnchorGridControlProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: AnchorGridValue;
  onChange: (id: string, value: AnchorGridValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const AnchorGridControl = (props: AnchorGridControlProps) => {
  const { id, name, description, defaultValue, onChange, readOnly, fullWidth } = props;
  const [value, setValue] = useState<AnchorGridValue>(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const select = (next: AnchorGridValue) => {
    setValue(next);
    onChange(id, next);
  };

  if (readOnly) {
    return (
      <ParamEditorControlItem name={name} description={description} fullWidth={fullWidth}>
        <ParamEditorReadOnlyValue>{value}</ParamEditorReadOnlyValue>
      </ParamEditorControlItem>
    );
  }

  const grid = (
    <Grid
      templateColumns="repeat(3, 1.5rem)"
      gap="1px"
      width="fit-content"
      bg="border.subtle"
      p="1px"
      borderRadius="sm"
    >
      {ANCHOR_GRID_VALUES.map((anchor) => {
        const selected = anchor === value;
        return (
          <IconButton
            key={anchor}
            aria-label={anchor}
            aria-pressed={selected}
            size="2xs"
            variant="ghost"
            bg={selected ? "fg" : "bg"}
            _hover={{ bg: selected ? "fg" : "bg.muted" }}
            borderRadius="0"
            onClick={() => select(anchor)}
          >
            <Box boxSize="0.375rem" borderRadius="full" bg={selected ? "bg" : "fg.muted"} />
          </IconButton>
        );
      })}
    </Grid>
  );

  return (
    <ParamEditorControlItem name={name} description={description} orientation={fullWidth ? "stacked" : "inline"}>
      {grid}
    </ParamEditorControlItem>
  );
};
