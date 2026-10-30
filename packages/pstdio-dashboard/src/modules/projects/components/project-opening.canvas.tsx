import { Dialog } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ProjectOpening } from "./project-opening";

const meta = {
  title: "Projects/Opening a cloud project",
  component: ProjectOpening,
  decorators: [
    (Story) => (
      <Dialog.Root open size="md">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Story />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    ),
  ],
  args: { projectName: "Shared notes", onRetry: () => {}, onBack: () => {} },
} satisfies CanvasMeta<typeof ProjectOpening>;
export default meta;
type Variant = CanvasVariant<typeof meta>;
export const PreparingFolder: Variant = { id: "projects-opening-a-cloud-project--preparing-folder" };
export const Downloading: Variant = {
  id: "projects-opening-a-cloud-project--downloading",
  args: { downloading: true },
};
export const SetupFailed: Variant = {
  id: "projects-opening-a-cloud-project--setup-failed",
  args: { error: "The project folder could not be created. Check the available disk space." },
};
export const Offline: Variant = {
  id: "projects-opening-a-cloud-project--offline",
  args: { error: "Connect to download this project for the first time." },
};
