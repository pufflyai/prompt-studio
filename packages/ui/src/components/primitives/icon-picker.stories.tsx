import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { IconPicker } from "./icon-picker";

const Picker = (props: { disabled?: boolean }) => {
  const [icon, setIcon] = useState<string | null>("folder");
  return (
    <Stack p="lg" align="start">
      <IconPicker value={icon} onChange={setIcon} disabled={props.disabled} />
      <Text role="status">{icon}</Text>
    </Stack>
  );
};
const meta = { title: "Components/Inputs/Icon Picker", component: Picker, tags: ["icon-picker"] } satisfies Meta<
  typeof Picker
>;
export default meta;
export const ChooseIcon: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Change icon" }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("button", { name: "book open" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("book-open");
    await userEvent.click(canvas.getByRole("button", { name: "Change icon" }));
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("button", { name: "book open" }),
    ).toHaveAttribute("aria-pressed", "true");
  },
};
export const Disabled: StoryObj<typeof meta> = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Change icon" });
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    await expect(within(canvasElement.ownerDocument.body).queryByRole("button", { name: "book open" })).toBeNull();
    await expect(canvas.getByRole("status")).toHaveTextContent("folder");
  },
};
