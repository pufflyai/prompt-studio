import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DisplayMenuSelect } from "./display-menu";

const LongGroupingMenu = () => {
  const [value, setValue] = useState("none");
  return (
    <Box width="18rem">
      <DisplayMenuSelect
        label="Grouping"
        value={value}
        onSelect={setValue}
        options={[
          { value: "none", label: "None" },
          ...Array.from({ length: 30 }, (_, index) => ({ value: String(index), label: `Property ${index + 1}` })),
        ]}
      />
      <Text data-testid="grouping">{value}</Text>
    </Box>
  );
};

const meta: Meta = { title: "Patterns/Collection View/Display Select" };
export default meta;
type Story = StoryObj;

export const LongOptions: Story = {
  render: () => <LongGroupingMenu />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("button", { name: /Grouping/ }));
    const menu = body.getByRole("menu");
    const viewport = menu.querySelector<HTMLElement>('[data-part="viewport"]');
    expect(viewport).not.toBeNull();
    expect(viewport!.scrollHeight).toBeGreaterThan(viewport!.clientHeight);
    expect(getComputedStyle(menu.querySelector('[data-part="scrollbar"]')!).width).toBe("2px");
    viewport!.scrollTop = viewport!.scrollHeight;
    await userEvent.click(body.getByRole("menuitem", { name: "Property 30", exact: true }));
    await expect(body.getByTestId("grouping")).toHaveTextContent("29");
  },
};
