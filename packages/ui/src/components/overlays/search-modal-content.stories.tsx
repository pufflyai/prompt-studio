import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { ListRow } from "@/components/list-row/list-row";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { SearchModalContent } from "./search-modal-content";

const ProjectListDialog = (props: { showSearch: boolean }) => {
  const { showSearch } = props;
  const [search, setSearch] = useState("");
  const projects = ["Prompt Studio", "Design tools", "Team notes"];
  return (
    <Dialog.Root open placement="center">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <SearchModalContent
            title="Projects"
            showSearch={showSearch}
            searchValue={search}
            searchPlaceholder="Search projects"
            searchAutoFocus
            showCloseButton
            footerEnd={
              <Button variant="outline" size="xs">
                Create project
              </Button>
            }
            onSearchChange={setSearch}
          >
            <Stack gap="0">
              {projects
                .filter((name) => !showSearch || name.toLowerCase().includes(search.toLowerCase()))
                .map((name) => (
                  <ListRow key={name} id={name} label={name} variant="full-width" />
                ))}
            </Stack>
          </SearchModalContent>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

const meta = {
  title: "Overlays/Search modal content",
  component: ProjectListDialog,
  parameters: { layout: "fullscreen" },
  args: { showSearch: true },
} satisfies Meta<typeof ProjectListDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Searchable: Story = {};
export const WithoutSearch: Story = {
  args: { showSearch: false },
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement).getByRole("dialog");
    await expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    await expect(within(dialog).getByRole("heading", { name: "Projects" })).toBeVisible();
  },
};
