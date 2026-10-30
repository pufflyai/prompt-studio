import { CloseButton } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { ParamEditorLabel } from "./param-editor-label";

const meta = {
  title: "Patterns/Param Editor/Label",
  component: ParamEditorLabel,
  args: {
    name: "Workspace type",
    description:
      "Create an isolated branch. Git review and merge cover the entire repository, including paths outside the project folder.",
  },
} satisfies CanvasMeta<typeof ParamEditorLabel>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const WithInformation: Story = {
  id: "patterns-param-editor-label--with-information",
};
export const Compact: Story = {
  id: "patterns-param-editor-label--compact",
  args: { compact: true },
};
export const WithoutInformation: Story = {
  id: "patterns-param-editor-label--without-information",
  args: { description: undefined },
};
export const InformationInDialog: Story = {
  id: "patterns-param-editor-label--information-in-dialog",
  decorators: [
    (Story) => (
      <Dialog.Root
        defaultOpen
        size="sm"
        scrollBehavior="inside"
        initialFocusEl={() => document.querySelector<HTMLButtonElement>('[aria-label="Close workspace dialog"]')}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Create workspace</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Story />
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Close workspace dialog" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    ),
  ],
};
