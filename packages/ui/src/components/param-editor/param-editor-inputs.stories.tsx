import { Box, Container, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
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
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const inputStory = (fixture: ParamEditorInputFixture): Story => ({
  render: () => <InputPreview fixture={fixture} />,
});

export const InputBoolean = inputStory(paramEditorInputFixtures.boolean);
export const InputNumber = inputStory(paramEditorInputFixtures.number);
export const InputText = inputStory(paramEditorInputFixtures.text);
export const InputMarkdown = inputStory(paramEditorInputFixtures.markdown);
export const InputSelection = inputStory(paramEditorInputFixtures.selection);
export const InputDate = inputStory(paramEditorInputFixtures.date);
export const InputColor = inputStory(paramEditorInputFixtures.color);
export const InputProperty = inputStory(paramEditorInputFixtures.property);
export const InputReadOnly = inputStory(paramEditorInputFixtures.readOnly);
export const InputResource = inputStory(paramEditorInputFixtures.resource);
export const InputReference = inputStory(paramEditorInputFixtures.reference);
export const InputRange = inputStory(paramEditorInputFixtures.range);
export const InputSegmented = inputStory(paramEditorInputFixtures.segmented);
export const InputActions = inputStory(paramEditorInputFixtures.actions);
export const InputAnchorGrid = inputStory(paramEditorInputFixtures.anchorGrid);
export const InputVector = inputStory(paramEditorInputFixtures.vector);
export const InputFileUpload = inputStory(paramEditorInputFixtures.fileUpload);
