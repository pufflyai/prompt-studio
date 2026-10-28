import { Dialog, HStack, Portal } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { autoBuildStoryConfiguration } from "./auto-build.story-fixture";
import { AutoBuildForm } from "./auto-build-form";
import { AutoBuildHelp } from "./auto-build-help";

function FormPreview(props: { children: ReactNode }) {
  const { children } = props;
  return (
    <Dialog.Root defaultOpen closeOnInteractOutside={false} size="lg" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap="xs">
                <Dialog.Title>Auto Build</Dialog.Title>
                <AutoBuildHelp t={(_key, fallback) => fallback ?? _key} />
              </HStack>
            </Dialog.Header>
            {children}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
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
export const SupervisorAndEligibleTickets: Story = {};
export const SelectedSupervisorModel: Story = {
  args: { supervisorModel: { harnessId: "codex", model: "example-model" } },
};
export const EmptyPrompt: Story = { args: { prompt: "" } };
export const Saving: Story = { args: { saving: true } };
export const Failure: Story = { args: { error: "Agent unavailable" } };
export const AllEligibleTickets: Story = { args: { eligible: { conjunction: "and", rules: [] } } };
export const TextFilter: Story = {
  args: {
    eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "calculator" }] },
  },
};
