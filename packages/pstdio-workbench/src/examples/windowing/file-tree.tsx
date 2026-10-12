import { Stack, Text } from "@chakra-ui/react";
import { TreeList } from "@pstdio/ui";
import { useState } from "react";

export const WindowingFileTree = (props: { label: string }) => {
  const { label } = props;
  const [selected, setSelected] = useState("index.ts");
  return (
    <Stack gap="sm">
      <TreeList
        sections={[
          {
            id: "files",
            label: `${label} files`,
            nodes: ["index.ts", "README.md"].map((name) => ({
              id: name,
              label: name,
              isNavigable: true,
              navigationIntent: { id: "open", payload: name },
            })),
          },
        ]}
        expandedSectionIds={["files"]}
        activeNodeId={selected}
        onNavigate={(event) => setSelected(event.nodeId)}
      />
      <Text aria-label={`${label} selected file`} textStyle="paragraph/S/regular">
        {selected}
      </Text>
    </Stack>
  );
};
