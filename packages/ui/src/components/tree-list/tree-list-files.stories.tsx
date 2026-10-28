import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { File, Folder } from "lucide-react";
import { TreeList } from "./tree-list";

const meta = {
  title: "Components/Data Display/Tree List/Files",
  component: TreeList,
} satisfies Meta<typeof TreeList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CompactFiles: Story = {
  render: () => (
    <Box h="full" w="full">
      <TreeList
        sections={[
          {
            id: "files",
            label: "Files",
            nodes: [
              {
                id: "src",
                label: "src",
                rowVariant: "file",
                icon: <Folder />,
                children: [
                  { id: "src/index.ts", label: "index.ts", rowVariant: "file", icon: <File /> },
                  { id: "src/notes.ts", label: "notes.ts", rowVariant: "file", icon: <File /> },
                ],
              },
              { id: "README.md", label: "README.md", rowVariant: "file", icon: <File /> },
            ],
          },
        ]}
        expandedNodeIds={["src"]}
        expandedSectionIds={["files"]}
        activeNodeId="src/notes.ts"
        nodeGap="0"
      />
    </Box>
  ),
};
