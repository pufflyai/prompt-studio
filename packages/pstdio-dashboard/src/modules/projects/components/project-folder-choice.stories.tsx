import { Dialog } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";
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
    onMethodChange: fn(),
    onClonePathChange: fn(),
    onBrowse: fn(),
    onNotNow: fn(),
    onContinue: fn(),
  },
} satisfies Meta<typeof ProjectFolderChoice>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A recorded git remote makes cloning the default. */
export const CloneRemote: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole("button", { name: "Clone and continue" }));
    await expect(args.onContinue).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("radio", { name: "Use a folder that already has it" }));
    await expect(args.onMethodChange).toHaveBeenCalledWith("existing");
  },
};

export const UseExistingFolder: Story = { args: { method: "existing" } };

/** Without a recorded remote, only an existing folder can be chosen. */
export const NoGitRemote: Story = { args: { gitRemote: null, method: "existing", clonePath: "" } };

export const CloneFailed: Story = {
  args: {
    error: "Could not clone git@github.com:pstdio/prompt-studio.git: Permission denied (publickey).",
  },
};
