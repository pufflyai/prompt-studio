import { CloseButton } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { ParamEditorLabel } from "./param-editor-label";

const meta = {
  title: "Design system/Patterns/Parameter editor/Label",
  component: ParamEditorLabel,
  args: {
    name: "Workspace type",
    description:
      "Create an isolated branch. Git review and merge cover the entire repository, including paths outside the project folder.",
  },
} satisfies CanvasMeta<typeof ParamEditorLabel>;
export default {
  title: "Design system/Patterns/Parameter editor/Label",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const WithInformation: Story = {
  id: "patterns-param-editor-label--with-information",
};
const Compact: Story = {
  id: "patterns-param-editor-label--compact",
  args: { compact: true },
};
const WithoutInformation: Story = {
  id: "patterns-param-editor-label--without-information",
  args: { description: undefined },
};
const InformationInDialog: Story = {
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

const Examples = createCanvasExampleNavigator(meta, {
  WithInformation,
  Compact,
  WithoutInformation,
  InformationInDialog,
});
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as WithInformation };
