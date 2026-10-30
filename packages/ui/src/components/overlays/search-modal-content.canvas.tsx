import { Button, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
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
} satisfies CanvasMeta<typeof ProjectListDialog>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Searchable: Story = {
  id: "overlays-search-modal-content--searchable",
};
export const WithoutSearch: Story = {
  id: "overlays-search-modal-content--without-search",
  args: { showSearch: false },
};
