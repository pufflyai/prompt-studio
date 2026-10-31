import { Box, Container, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
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
  title: "Patterns/Param Editor",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
const inputStory = (fixture: ParamEditorInputFixture): Story => ({
  render: () => <InputPreview fixture={fixture} />,
});
export const InputBoolean = {
  id: "patterns-param-editor--input-boolean",
  ...inputStory(paramEditorInputFixtures.boolean),
};
export const InputNumber = {
  id: "patterns-param-editor--input-number",
  ...inputStory(paramEditorInputFixtures.number),
};
export const InputText: Story = {
  id: "patterns-param-editor--input-text",
  ...inputStory(paramEditorInputFixtures.text),
};
export const InputMarkdown = {
  id: "patterns-param-editor--input-markdown",
  ...inputStory(paramEditorInputFixtures.markdown),
};
export const InputSelection = {
  id: "patterns-param-editor--input-selection",
  ...inputStory(paramEditorInputFixtures.selection),
};
// A long value truncates inside its button, so the field keeps its label and stays inside the panel.
export const InputSelectionLongValues: Story = {
  id: "patterns-param-editor--input-selection-long-values",
  ...inputStory(paramEditorInputFixtures.longSelection),
};
export const InputDate = {
  id: "patterns-param-editor--input-date",
  ...inputStory(paramEditorInputFixtures.date),
};
/** A read-only timestamp shows in the viewer's locale and time zone. */
export const InputDateReadOnly = {
  id: "patterns-param-editor--input-date-read-only",
  ...inputStory(paramEditorInputFixtures.dateReadOnly),
};
export const InputColor = {
  id: "patterns-param-editor--input-color",
  ...inputStory(paramEditorInputFixtures.color),
};
export const InputProperty = {
  id: "patterns-param-editor--input-property",
  ...inputStory(paramEditorInputFixtures.property),
};
export const InputReadOnly = {
  id: "patterns-param-editor--input-read-only",
  ...inputStory(paramEditorInputFixtures.readOnly),
};
export const InputResource = {
  id: "patterns-param-editor--input-resource",
  ...inputStory(paramEditorInputFixtures.resource),
};
export const InputReference = {
  id: "patterns-param-editor--input-reference",
  ...inputStory(paramEditorInputFixtures.reference),
};
export const InputRange = {
  id: "patterns-param-editor--input-range",
  ...inputStory(paramEditorInputFixtures.range),
};
export const InputSegmented = {
  id: "patterns-param-editor--input-segmented",
  ...inputStory(paramEditorInputFixtures.segmented),
};
export const InputActions = {
  id: "patterns-param-editor--input-actions",
  ...inputStory(paramEditorInputFixtures.actions),
};
export const InputAnchorGrid = {
  id: "patterns-param-editor--input-anchor-grid",
  ...inputStory(paramEditorInputFixtures.anchorGrid),
};
export const InputVector = {
  id: "patterns-param-editor--input-vector",
  ...inputStory(paramEditorInputFixtures.vector),
};
export const InputFileUpload = {
  id: "patterns-param-editor--input-file-upload",
  ...inputStory(paramEditorInputFixtures.fileUpload),
};
