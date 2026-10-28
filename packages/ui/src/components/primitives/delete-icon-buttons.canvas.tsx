import { Box, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Trash2 } from "lucide-react";
import { expect, waitFor, within } from "storybook/test";
import { getThemePreferenceClassNames } from "@/utils/apply-theme-preference";

const meta = {
  title: "Components/Inputs/Delete Icon Buttons",
  args: { mode: "light" as "light" | "dark" },
  render: ({ mode }) => (
    <Stack
      className={getThemePreferenceClassNames(`pstdio-${mode}`, mode).join(" ")}
      data-color-mode={mode}
      data-theme={`pstdio-${mode}`}
      color="fg"
      padding="md"
      background="bg"
      gap="md"
    >
      <Text textStyle="label/M/medium">Delete actions</Text>
      <Box data-testid="idle-reference" color="fg.subtle" background="transparent" />
      <Box data-testid="active-reference" color="fg.error" background="bg.error" />
      <HStack gap="sm">
        <IconButton variant="destructive-ghost" aria-label="Delete item">
          <Icon as={Trash2} />
        </IconButton>
        <IconButton variant="destructive-ghost" aria-label="Delete disabled item" disabled>
          <Icon as={Trash2} />
        </IconButton>
      </HStack>
      <HStack className="group" data-testid="status-row" gap="sm" padding="sm">
        <Text textStyle="label/S">Status row</Text>
        <IconButton variant="destructive-ghost" size="xs" aria-label="Delete status">
          <Icon as={Trash2} />
        </IconButton>
        <IconButton variant="destructive-ghost" size="xs" aria-label="Delete default status" disabled>
          <Icon as={Trash2} />
        </IconButton>
      </HStack>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Delete item", exact: true });
    const idle = getComputedStyle(canvas.getByTestId("idle-reference"));
    const active = getComputedStyle(canvas.getByTestId("active-reference"));
    const expectColors = async (element: HTMLElement, reference: CSSStyleDeclaration) => {
      await waitFor(() => {
        expect(getComputedStyle(element).color).toBe(reference.color);
        expect(getComputedStyle(element).backgroundColor).toBe(reference.backgroundColor);
      });
    };
    await expectColors(button, idle);
    button.setAttribute("data-hover", "");
    await expectColors(button, active);
    button.removeAttribute("data-hover");
    await expectColors(button, idle);
    button.setAttribute("data-focus-visible", "");
    await expectColors(button, active);
    button.removeAttribute("data-focus-visible");
    button.setAttribute("data-active", "");
    await expectColors(button, active);
    button.removeAttribute("data-active");
    canvas.getByTestId("status-row").setAttribute("data-hover", "");
    await expectColors(canvas.getByRole("button", { name: "Delete status", exact: true }), active);
    await expectColors(canvas.getByRole("button", { name: "Delete default status", exact: true }), idle);
    canvas.getByRole("button", { name: "Delete disabled item", exact: true }).setAttribute("data-hover", "");
    await expectColors(canvas.getByRole("button", { name: "Delete disabled item", exact: true }), idle);
    canvas.getByTestId("status-row").removeAttribute("data-hover");
    canvas.getByRole("button", { name: "Delete disabled item", exact: true }).removeAttribute("data-hover");
  },
} satisfies Meta<{ mode: "light" | "dark" }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { args: { mode: "dark" } };
