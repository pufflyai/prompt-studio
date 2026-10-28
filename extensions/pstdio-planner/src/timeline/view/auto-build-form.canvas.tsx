import { Dialog, HStack, Portal } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
const meta: CanvasMeta<typeof AutoBuildForm> = {
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
type Story = CanvasVariant<typeof AutoBuildForm>;
export const SupervisorAndEligibleTickets: Story = {
  id: "extensions-planner-auto-build-form--supervisor-and-eligible-tickets",
};
export const SelectedSupervisorModel: Story = {
  id: "extensions-planner-auto-build-form--selected-supervisor-model",
  args: { supervisorModel: { harnessId: "codex", model: "example-model" } },
};
export const EmptyPrompt: Story = {
  id: "extensions-planner-auto-build-form--empty-prompt",
  args: { prompt: "" },
};
export const Saving: Story = {
  id: "extensions-planner-auto-build-form--saving",
  args: { saving: true },
};
export const Failure: Story = {
  id: "extensions-planner-auto-build-form--failure",
  args: { error: "Agent unavailable" },
};
export const AllEligibleTickets: Story = {
  id: "extensions-planner-auto-build-form--all-eligible-tickets",
  args: { eligible: { conjunction: "and", rules: [] } },
};
export const TextFilter: Story = {
  id: "extensions-planner-auto-build-form--text-filter",
  args: {
    eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "calculator" }] },
  },
};
