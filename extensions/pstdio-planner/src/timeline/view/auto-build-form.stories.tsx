import { Button, Popover, useSlotRecipe } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui/theme";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { autoBuildStoryConfiguration } from "./auto-build.story-fixture";
import { AutoBuildForm } from "./auto-build-form";

function FormPreview(props: { children: ReactNode }) {
  const { children } = props;
  const panel = useSlotRecipe({ recipe: psTheme.getSlotRecipe("popover") })({ variant: "panel" });
  return (
    <Popover.Root defaultOpen positioning={{ placement: "bottom-start" }}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="outline">
          Auto Build
        </Button>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content css={panel.content}>{children}</Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
}
const meta: Meta<typeof AutoBuildForm> = {
  title: "Extensions/Planner/Auto Build form",
  component: AutoBuildForm,
  decorators: [
    (Story) => (
      <FormPreview>
        <Story />
      </FormPreview>
    ),
  ],
  args: { ...autoBuildStoryConfiguration, onClose: () => {}, t: (_key, fallback) => fallback ?? _key },
};
export default meta;
type Story = StoryObj<typeof AutoBuildForm>;
export const PromptAndTicketFilters: Story = {};
export const EmptyPrompt: Story = { args: { prompt: "" } };
export const Saving: Story = { args: { saving: true } };
export const Failure: Story = { args: { error: "Agent unavailable" } };
export const AllEligibleTickets: Story = { args: { eligible: { conjunction: "and", rules: [] } } };
export const TextFilter: Story = {
  args: {
    eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "calculator" }] },
  },
};
