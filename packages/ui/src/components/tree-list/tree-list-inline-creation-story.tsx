import { Stack, Text } from "@chakra-ui/react";
import { FileText, Folder } from "lucide-react";
import { useState } from "react";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";

export const TreeListInlineCreationStory = () => {
  const [createdName, setCreatedName] = useState<string>();
  const sections: TreeListSection[] = [
    {
      id: "files",
      label: "Files",
      nodes: [
        { id: "docs", label: "docs", icon: <Folder size={16} /> },
        ...(createdName
          ? [{ id: createdName, label: createdName, icon: <FileText size={16} /> }]
          : [
              {
                id: "new-file",
                label: "New file",
                icon: <FileText size={16} />,
                inlineInput: {
                  ariaLabel: "New file name",
                  placeholder: "file-name",
                  onCommit: (value: string) => {
                    if (!value) throw new Error("Enter a file name.");
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
        Enter commits the file name. Escape or blur cancels creation.
      </Text>
    </Stack>
  );
};
