import { Flex } from "@chakra-ui/react";
import { DiffViewer } from "@pstdio/ui";
import { dashboardChangedFilePaths, dashboardWorkspaceDiffs } from "../workspace-review-fixtures";

export const WorkspaceChangesWidget = () => (
  <Flex h="full" minH="0" direction="column">
    <DiffViewer
      diffs={dashboardWorkspaceDiffs}
      changedFilePaths={dashboardChangedFilePaths}
      defaultSelectedPath={dashboardWorkspaceDiffs[0]?.newPath}
    />
  </Flex>
);
