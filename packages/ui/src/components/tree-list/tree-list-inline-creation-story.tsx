import { Stack, Text } from "@chakra-ui/react";
import { FileText, Folder } from "lucide-react";
import { useState } from "react";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";

export const TreeListInlineCreationStory = (props: { type?: "file" | "folder" }) => {
  const { type = "file" } = props;
  const [createdName, setCreatedName] = useState<string>();
  const label = type === "folder" ? "folder" : "file";
  const icon = type === "folder" ? <Folder size={16} /> : <FileText size={16} />;
  const sections: TreeListSection[] = [
    {
      id: "files",
      label: "Files",
      nodes: [
        { id: "docs", label: "docs", icon: <Folder size={16} /> },
        ...(createdName
          ? [{ id: createdName, label: createdName, icon }]
          : [
              {
                id: `new-${label}`,
                label: `New ${label}`,
                icon,
                inlineInput: {
                  ariaLabel: `New ${label} name`,
                  placeholder: `${label}-name`,
                  onCommit: (value: string) => {
                    if (!value) throw new Error(`Enter a ${label} name.`);
                    setCreatedName(value);
                  },
                },
              },
            ]),
      ],
    },
  ];

  return (
    <Stack maxW="20rem" gap="md">
      <Stack borderWidth="1px" p="xs">
        <TreeList sections={sections} expandedSectionIds={["files"]} rowVariant="tree" />
      </Stack>
      <Text textStyle="label/XS" color="fg.muted">
        Enter commits the {label} name. Escape or blur cancels creation.
      </Text>
    </Stack>
  );
};
