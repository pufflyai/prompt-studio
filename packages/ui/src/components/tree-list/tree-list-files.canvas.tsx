import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { File, Folder } from "lucide-react";
import { TreeList } from "./tree-list";

const meta = {
  title: "Components/Data Display/Tree List/Files",
  component: TreeList,
} satisfies CanvasMeta<typeof TreeList>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const CompactFiles: Story = {
  id: "components-data-display-tree-list-files--compact-files",
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
