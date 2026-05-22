import { Flex } from "@chakra-ui/react";
import { DiffViewer } from "@pstdio/ui";
import { dashboardChangedFilePaths, dashboardWorkspaceDiffs } from "../mock-data/workspaces";

export const WorkspaceChangesWidget = () => (
  <Flex h="full" minH="0" direction="column">
    <DiffViewer
      diffs={dashboardWorkspaceDiffs}
      changedFilePaths={dashboardChangedFilePaths}
      defaultSelectedPath={dashboardWorkspaceDiffs[0]?.newPath}
    />
  </Flex>
);
