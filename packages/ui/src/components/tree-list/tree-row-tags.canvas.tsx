import { Box } from "@chakra-ui/react";
import { BookOpen, FileText, Folder } from "lucide-react";
import { useState } from "react";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";
import { TreeRowTags } from "./tree-row-tags";

export default {
  title: "Design system/Components/Data display/Tree list/Row tags",
  description: "Tags between a row's label and its count badge. Synthetic data only.",
};

const tagSections = (): TreeListSection[] => [
  {
    id: "rulebooks",
    label: "Rulebooks",
    nodes: [
      {
        id: "apparel",
        label: "Apparel rulebook",
        icon: <BookOpen size={14} />,
        isNavigable: true,
        endContent: (
          <TreeRowTags
            tags={[
              { id: "eu", label: "EU", color: "blue" },
              { id: "draft", label: "Draft", color: "orange", icon: "pencil" },
            ]}
            badge={{ label: "3", color: "red" }}
          />
        ),
        children: [
          {
            id: "apparel-titles",
            label: "Titles and naming conventions",
            icon: <FileText size={14} />,
            isNavigable: true,
            endContent: (
              <TreeRowTags
                tags={[
                  { id: "web", label: "Web shop", color: "green" },
                  { id: "market", label: "Marketplace", color: "purple" },
                  { id: "us", label: "US", color: "orange" },
                  { id: "required", label: "Required" },
                ]}
              />
            ),
          },
          {
            id: "apparel-images",
            label: "Images",
            icon: <FileText size={14} />,
            isNavigable: true,
            endContent: <TreeRowTags tags={[{ id: "web", label: "Web shop", color: "green" }]} />,
          },
        ],
      },
      {
        id: "electronics",
        label: "Electronics rulebook",
        icon: <Folder size={14} />,
        isNavigable: true,
        endContent: <TreeRowTags badge={{ label: "12" }} />,
      },
    ],
  },
];

const RowTagsPreview = (props: { width: number }) => {
  const [expanded, setExpanded] = useState(["apparel"]);
  const [active, setActive] = useState<string | null>("apparel-titles");
  return (
    <Box width={`${props.width}px`} height="320px" padding="xs" background="bg.subtle" borderRightWidth="1px">
      <TreeList
        sections={tagSections()}
        expandedNodeIds={expanded}
        activeNodeId={active}
        onToggleNode={(id) =>
          setExpanded((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]))
        }
        onNavigate={(event) => setActive(event.nodeId)}
      />
    </Box>
  );
};

/** Narrow the panel to see tags truncate; rows with more than two tags collapse the rest into "+N". */
export const RowTags = {
  args: { width: 280 },
  controls: { width: { type: "number", label: "Panel width", min: 180, max: 420, step: 20 } },
  render: (args: { width: number }) => <RowTagsPreview width={args.width} />,
};
