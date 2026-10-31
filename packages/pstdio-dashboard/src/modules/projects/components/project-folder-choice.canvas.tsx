import { Dialog } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ProjectFolderChoice } from "./project-folder-choice";

const meta = {
  title: "Projects/Project folder",
  component: ProjectFolderChoice,
  decorators: [
    (Story) => (
      <Dialog.Root open size="md">
        <Dialog.Positioner>
          <Dialog.Content>
            <Story />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    ),
  ],
  args: {
    projectName: "Prompt Studio",
    gitRemote: "git@github.com:pstdio/prompt-studio.git",
    method: "clone",
    clonePath: "~/Projects/prompt-studio",
    pending: false,
    onMethodChange: () => {},
    onClonePathChange: () => {},
    onBrowse: () => {},
    onNotNow: () => {},
    onContinue: () => {},
  },
} satisfies CanvasMeta<typeof ProjectFolderChoice>;
export default meta;
type Story = CanvasFrame<typeof meta>;
/** A recorded git remote makes cloning the default. */
export const CloneRemote: Story = {
  id: "projects-project-folder--clone-remote",
};
export const UseExistingFolder: Story = {
  id: "projects-project-folder--use-existing-folder",
  args: { method: "existing" },
};
/** Without a recorded remote, only an existing folder can be chosen. */
export const NoGitRemote: Story = {
  id: "projects-project-folder--no-git-remote",
  args: { gitRemote: null, method: "existing", clonePath: "" },
};
export const CloneFailed: Story = {
  id: "projects-project-folder--clone-failed",
  args: {
    error: "Could not clone git@github.com:pstdio/prompt-studio.git: Permission denied (publickey).",
  },
};
