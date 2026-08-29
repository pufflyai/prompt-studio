import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MarkdownEditor } from "./markdown-editor";

const regressionSource = `# Source preservation

Edit one word in this sentence. Keep {{fds:text:EXAMPLE.REGULAR_INSEAM_SENTENCE}} unchanged.

| Name |Value|
|:---|---:|
| Alice | 1 |

[Prompt Studio][project]

[project]: https://example.com  "Project"

~~~json
{"enabled": true}
~~~`;

const LosslessSourceStory = () => {
  const [markdown, setMarkdown] = useState(regressionSource);

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} gap="md">
      <Box borderWidth="1px" borderColor="border.subtle" minH="30rem">
        <MarkdownEditor defaultState={regressionSource} isEditable onChange={setMarkdown} />
      </Box>
      <Stack gap="sm" minW="0">
        <Text textStyle="label/M/medium">Emitted Markdown source</Text>
        <Box
          as="pre"
          data-testid="markdown-editor-output"
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="sm"
          minH="30rem"
          overflow="auto"
          p="sm"
          textStyle="mono/XS"
          whiteSpace="pre-wrap"
        >
          {markdown}
        </Box>
      </Stack>
    </SimpleGrid>
  );
};

const meta: Meta<typeof MarkdownEditor> = {
  title: "Patterns/Editors/Markdown Editor/Source Preservation",
  component: MarkdownEditor,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof MarkdownEditor>;

export const LosslessEditing: Story = {
  render: () => <LosslessSourceStory />,
};
