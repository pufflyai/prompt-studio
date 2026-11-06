import { Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ScrollArea } from "../../components/primitives/scroll-area";
import { TreeList } from "../../components/tree-list/tree-list";
import type { TreeListNode } from "../../components/tree-list/tree-list.types";

const paths = [
  "Design system/Foundations/Colors",
  "Design system/Foundations/Themes",
  "Design system/Foundations/Icons",
  "Design system/Components/Forms/Button",
  "Design system/Components/Data display/Tree list",
  "Design system/Components/Overlays/Folder picker",
  "Design system/Patterns/Chat/Composer",
  "Design system/Patterns/Motion/Row creation",
  "Product/Workbench/Navigation/Sidebar",
  "Product/Workbench/Panels/Floating panel",
  "Product/Projects/Project picker",
  "Product/Sessions/Device selector",
  "Product/Settings/Extensions",
  "Product/Desktop/Startup",
  "Product/Reference/Extension API",
  "Extensions/UI Canvas/Workspace",
  "Extensions/Planner/Timeline",
  "Extensions/Artifacts/Library",
  "Extensions/Notes/Editor",
  "Extensions/Home/Project home",
  "Extensions/Onboarding/Setup",
  "Extensions/Prompt Studio Dev/Compare commits",
  "Website/Landing/Tool demo",
  "Website/Docs/Document column",
  "Website/Brand/OS logos",
  "Proposals/PS-100 Browser panel and element selection",
  "Proposals/PS-105 Canvas catalog",
];

const nodes: TreeListNode[] = [];
for (const path of paths) {
  let siblings = nodes;
  const parts = path.split("/");
  parts.forEach((label, index) => {
    const id = parts.slice(0, index + 1).join("/");
    let node = siblings.find((item) => item.id === id);
    if (!node) {
      const leaf = index === parts.length - 1;
      node = { id, label, isContainer: !leaf, ...(leaf ? { isNavigable: true } : { children: [] }) };
      siblings.push(node);
    }
    siblings = node.children ?? [];
  });
}

function Catalog({ initialPath = "" }: { initialPath?: string }) {
  const [selected, setSelected] = useState(initialPath);
  const [expanded, setExpanded] = useState(
    initialPath
      .split("/")
      .slice(0, -1)
      .map((_, index, parts) => parts.slice(0, index + 1).join("/")),
  );
  return (
    <Stack h="full" minH="0" p="md" gap="md" bg="bg" color="fg">
      <Text textStyle="heading/M">UI Canvas</Text>
      <Text color="fg.muted">Proposed catalog · representative examples</Text>
      <ScrollArea flex="1" minH="0">
        <TreeList
          sections={[{ id: "catalog", nodes }]}
          expandedNodeIds={expanded}
          activeNodeId={selected}
          onToggleNode={(id) =>
            setExpanded((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
          }
          onNavigate={(event) => setSelected(event.nodeId)}
        />
      </ScrollArea>
      <Text aria-live="polite">{selected || "Choose a category to browse its canvases."}</Text>
      {selected === "Design system/Components/Forms/Button" && <Text>Frames: Default · Loading · Disabled</Text>}
    </Stack>
  );
}

export default { title: "Proposals/PS-105 Canvas catalog", fullscreen: true } satisfies CanvasMeta;
export const FiveCategories = { name: "Five categories", render: () => <Catalog /> };
export const CanonicalComponent = {
  name: "Canonical component",
  render: () => <Catalog initialPath="Design system/Components/Forms/Button" />,
};
export const ExtensionOwnership = {
  name: "Extension ownership",
  render: () => <Catalog initialPath="Extensions/UI Canvas/Workspace" />,
};
