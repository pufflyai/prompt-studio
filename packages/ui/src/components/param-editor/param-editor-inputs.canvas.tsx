import { Box, Container, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { ParamEditor } from "./param-editor";
import type { ParamValueMap } from "./param-editor.types";
import { type ParamEditorInputFixture, paramEditorInputFixtures } from "./param-editor-control-fixtures";
import { ParamEditorHorizontal } from "./param-editor-horizontal";

const InputPreview = (props: { fixture: ParamEditorInputFixture }) => {
  const { fixture } = props;
  const [values, setValues] = useState<ParamValueMap>(fixture.defaultValues);
  const common = {
    params: [fixture.param],
    defaultValues: values,
    onChange: (id: string, value: ParamValueMap[string]) => setValues((current) => ({ ...current, [id]: value })),
    onOpenResource: () => {},
  };
  return (
    <Container padding="md" maxWidth="none">
      <Stack gap="lg">
        <Stack gap="xs">
          <Text textStyle="label/S/medium">Vertical</Text>
          <Box
            maxWidth="360px"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="xs"
            bg="bg.subtle"
            overflow="hidden"
          >
            <ParamEditor {...common} />
          </Box>
        </Stack>
        {fixture.param.type !== "anchorGrid" ? (
          <Stack gap="xs">
            <Text textStyle="label/S/medium">Horizontal</Text>
            <HStack minHeight="4rem" alignItems="start">
              <ParamEditorHorizontal {...common} />
            </HStack>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
};
const meta = {
  title: "Design system/Patterns/Parameter editor/Inputs",
  fullscreen: true,
} satisfies CanvasMeta;
export default {
  title: "Design system/Patterns/Parameter editor/Inputs",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const inputStory = (fixture: ParamEditorInputFixture): Story => ({
  render: () => <InputPreview fixture={fixture} />,
});
const InputBoolean = {
  id: "patterns-param-editor--input-boolean",
  ...inputStory(paramEditorInputFixtures.boolean),
};
const InputNumber = {
  id: "patterns-param-editor--input-number",
  ...inputStory(paramEditorInputFixtures.number),
};
const InputText: Story = {
  id: "patterns-param-editor--input-text",
  ...inputStory(paramEditorInputFixtures.text),
};
const InputMarkdown = {
  id: "patterns-param-editor--input-markdown",
  ...inputStory(paramEditorInputFixtures.markdown),
};
const InputSelection = {
  id: "patterns-param-editor--input-selection",
  ...inputStory(paramEditorInputFixtures.selection),
};
// A long value truncates inside its button, so the field keeps its label and stays inside the panel.
const InputSelectionLongValues: Story = {
  id: "patterns-param-editor--input-selection-long-values",
  ...inputStory(paramEditorInputFixtures.longSelection),
};
const InputDate = {
  id: "patterns-param-editor--input-date",
  ...inputStory(paramEditorInputFixtures.date),
};
/** A read-only timestamp shows in the viewer's locale and time zone. */
const InputDateReadOnly = {
  id: "patterns-param-editor--input-date-read-only",
  ...inputStory(paramEditorInputFixtures.dateReadOnly),
};
const InputColor = {
  id: "patterns-param-editor--input-color",
  ...inputStory(paramEditorInputFixtures.color),
};
const InputProperty = {
  id: "patterns-param-editor--input-property",
  ...inputStory(paramEditorInputFixtures.property),
};
const InputReadOnly = {
  id: "patterns-param-editor--input-read-only",
  ...inputStory(paramEditorInputFixtures.readOnly),
};
const InputResource = {
  id: "patterns-param-editor--input-resource",
  ...inputStory(paramEditorInputFixtures.resource),
};
const InputReference = {
  id: "patterns-param-editor--input-reference",
  ...inputStory(paramEditorInputFixtures.reference),
};
const InputRange = {
  id: "patterns-param-editor--input-range",
  ...inputStory(paramEditorInputFixtures.range),
};
const InputSegmented = {
  id: "patterns-param-editor--input-segmented",
  ...inputStory(paramEditorInputFixtures.segmented),
};
const InputActions = {
  id: "patterns-param-editor--input-actions",
  ...inputStory(paramEditorInputFixtures.actions),
};
const InputAnchorGrid = {
  id: "patterns-param-editor--input-anchor-grid",
  ...inputStory(paramEditorInputFixtures.anchorGrid),
};
const InputVector = {
  id: "patterns-param-editor--input-vector",
  ...inputStory(paramEditorInputFixtures.vector),
};
const InputFileUpload = {
  id: "patterns-param-editor--input-file-upload",
  ...inputStory(paramEditorInputFixtures.fileUpload),
};

const Examples = createCanvasExampleNavigator(meta, {
  InputBoolean,
  InputNumber,
  InputText,
  InputMarkdown,
  InputSelection,
  InputSelectionLongValues,
  InputDate,
  InputDateReadOnly,
  InputColor,
  InputProperty,
  InputReadOnly,
  InputResource,
  InputReference,
  InputRange,
  InputSegmented,
  InputActions,
  InputAnchorGrid,
  InputVector,
  InputFileUpload,
});
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as InputBoolean };
