import { HStack, Text } from "@chakra-ui/react";
import { WorkbenchBreadcrumbView, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { ProjectCrumb } from "../../projects/components/project-crumb";

export const DesktopProjectBreadcrumb = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;

  return (
    <HStack gap="xs" h="full" minW="0" w="full">
      <ProjectCrumb workbench={input.workbench} />
      <Text aria-hidden="true" color="fg.subtle" flexShrink={0}>
        /
      </Text>
      <WorkbenchBreadcrumbView workbench={input.workbench} />
    </HStack>
  );
};
