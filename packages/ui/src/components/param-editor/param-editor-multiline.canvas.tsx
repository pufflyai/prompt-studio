import { Box, Container, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
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
  title: "Design system/Patterns/Parameter editor/Multiline text",
  component: MultilinePreview,
  fullscreen: true,
} satisfies CanvasMeta<typeof MultilinePreview>;
export default {
  title: "Design system/Patterns/Parameter editor/Multiline text",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const Editable: Story = {
  id: "patterns-param-editor-multiline-text--editable",
};
const Grouped: Story = {
  id: "patterns-param-editor-multiline-text--grouped",
  ...Editable,
  args: { grouped: true },
};
const Small: Story = {
  id: "patterns-param-editor-multiline-text--small",
  ...Editable,
  args: { grouped: true, variant: "small" },
};
const ReadOnly: Story = {
  id: "patterns-param-editor-multiline-text--read-only",
  args: { grouped: true, readOnly: true },
};

const Examples = createCanvasExampleNavigator(meta, { Editable, Grouped, Small, ReadOnly });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Editable };
