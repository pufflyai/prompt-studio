import { Box, Container, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { ParamEditor } from "./param-editor";
import type { Param, ParamValueMap } from "./param-editor.types";
import { ParamEditorHorizontal } from "./param-editor-horizontal";

const params: Param[] = [
  { id: "title", name: "Title", type: "text", defaultValue: "Workspace summary" },
  {
    id: "instructions",
    name: "Instructions",
    type: "text",
    singleLine: false,
    defaultValue: "Summarize the selected changes.\nInclude the next steps.",
  },
];
const MultilinePreview = (props: { readOnly?: boolean; grouped?: boolean; variant?: "default" | "small" }) => {
  const { readOnly, grouped, variant } = props;
  const [values, setValues] = useState<ParamValueMap>({});
  const fields = grouped ? { groups: [{ id: "content", title: "Content", params }] } : { params };
  const common = {
    ...fields,
    readOnly,
    variant,
    defaultValues: values,
    onChange: (id: string, value: ParamValueMap[string]) => setValues((current) => ({ ...current, [id]: value })),
  };
  return (
    <Container padding="md" maxWidth="none">
      <Stack gap="md" maxWidth="360px">
        <Box data-testid="vertical-editor">
          <ParamEditor {...common} />
        </Box>
        <Box data-testid="horizontal-editor">
          <ParamEditorHorizontal {...common} />
        </Box>
      </Stack>
    </Container>
  );
};
const meta = {
  title: "Patterns/Param Editor/Multiline Text",
  component: MultilinePreview,
  parameters: { layout: "fullscreen" },
} satisfies CanvasMeta<typeof MultilinePreview>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Editable: Story = {
  id: "patterns-param-editor-multiline-text--editable",
};
export const Grouped: Story = {
  id: "patterns-param-editor-multiline-text--grouped",
  ...Editable,
  args: { grouped: true },
};
export const Small: Story = {
  id: "patterns-param-editor-multiline-text--small",
  ...Editable,
  args: { grouped: true, variant: "small" },
};
export const ReadOnly: Story = {
  id: "patterns-param-editor-multiline-text--read-only",
  args: { grouped: true, readOnly: true },
};
