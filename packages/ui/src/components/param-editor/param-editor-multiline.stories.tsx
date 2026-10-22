import { Box, Container, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
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
} satisfies Meta<typeof MultilinePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const orientation of ["vertical", "horizontal"]) {
      const editor = canvas.getByTestId(`${orientation}-editor`);
      const input = within(editor).getByRole("textbox", { name: "Instructions" });
      const label = within(editor).getByText("Instructions");
      await expect(input.tagName).toBe("TEXTAREA");
      await expect(label.getBoundingClientRect().bottom).toBeLessThanOrEqual(input.getBoundingClientRect().top);
      const inset = orientation === "vertical" ? 24 : 0;
      await expect(input.getBoundingClientRect().width).toBe(editor.getBoundingClientRect().width - inset);
    }
  },
};

export const Grouped: Story = { ...Editable, args: { grouped: true } };
export const Small: Story = { ...Editable, args: { grouped: true, variant: "small" } };
export const ReadOnly: Story = {
  args: { grouped: true, readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const orientation of ["vertical", "horizontal"]) {
      const editor = canvas.getByTestId(`${orientation}-editor`);
      const label = within(editor).getByText("Instructions");
      const value = within(editor).getByText(/Summarize the selected changes/);
      await expect(label.getBoundingClientRect().bottom).toBeLessThanOrEqual(value.getBoundingClientRect().top);
      await expect(value).toHaveStyle({ whiteSpace: "pre-wrap" });
    }
  },
};
